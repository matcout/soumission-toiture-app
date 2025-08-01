// firebaseSync.js - Synchronisation unifiée Mobile/Desktop
import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc, 
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage } from './firebase';

class FirebaseSync {
// NOUVELLE VERSION NETTOYÉE (seulement les vrais dossiers système) :
static SYSTEM_FOLDERS = {
  assignments: {
    slug: 'assignments',
    label: 'Aller prendre mesure',
    icon: 'clipboard-list',
    iconDesktop: 'ClipboardList',
    color: '#3b82f6',
    order: 0,
    type: 'system',
    filter: { type: 'folderId', value: 'assignments' } // ✅ folderId uniquement
  },
  pending: {
    slug: 'pending',
    label: 'À compléter',
    icon: 'clock',
    iconDesktop: 'Clock',
    color: '#f59e0b',
    order: 1,
    type: 'system',
    filter: { type: 'folderId', value: 'pending' } // ✅ folderId uniquement
  }
};

  // 🚀 INITIALISATION
static async initialize() {
  console.log('🔥 Initialisation FirebaseSync...');
  
  try {
    // Créer les dossiers système s'ils n'existent pas
    for (const [key, folder] of Object.entries(this.SYSTEM_FOLDERS)) {
      const folderRef = doc(db, 'folders', folder.slug);
      const folderDoc = await getDoc(folderRef);
      
      if (!folderDoc.exists()) {
        console.log(`📁 Création dossier système: ${folder.label} avec order=${folder.order}`);
        await setDoc(folderRef, {
          ...folder,
          id: folder.slug, // ID = slug pour les dossiers système
          createdAt: serverTimestamp(),
          platform: 'system'
        });
        console.log(`✅ Dossier système créé: ${folder.label}`);
      } else {
        // 🆕 VÉRIFIER SI L'ORDRE EST CORRECT
        const existingData = folderDoc.data();
        console.log(`📋 Dossier existant: ${folder.label}, order actuel=${existingData.order}, order attendu=${folder.order}`);
        
        // 🆕 METTRE À JOUR SI L'ORDRE EST INCORRECT
        if (existingData.order !== folder.order) {
          console.log(`🔧 Mise à jour order pour ${folder.label}: ${existingData.order} → ${folder.order}`);
          await updateDoc(folderRef, { order: folder.order });
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur initialisation:', error);
    return { success: false, error: error.message };
  }
}

  // 📁 GESTION DES DOSSIERS
  static subscribeFolders(callback) {
    console.log('📁 Abonnement aux dossiers...');
    
    const q = query(collection(db, 'folders'), orderBy('order', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const folders = {};
      const foldersList = [];
      
    snapshot.forEach((doc) => {
  const data = doc.data();
  console.log(`📋 Dossier Firebase: ${data.label}, order=${data.order}, slug=${data.slug}`); // 🆕 LOG
  
  const folderData = {
    ...data,
    id: doc.id,
    slug: data.slug || doc.id, // Fallback sur ID si pas de slug
    // Créer la fonction de filtre
    filterFn: this.createFilterFunction(data.filter || { type: 'slug', value: data.slug || doc.id })
  };
  
  folders[folderData.slug] = folderData;
  foldersList.push(folderData);
});
      
      console.log(`✅ ${Object.keys(folders).length} dossiers synchronisés`);
      callback({ 
        success: true, 
        data: folders,
        list: foldersList 
      });
    }, (error) => {
      console.error('❌ Erreur sync dossiers:', error);
      callback({ 
        success: false, 
        error: error.message,
        data: {},
        list: []
      });
    });
    
    return unsubscribe;
  }

  // 📄 GESTION DES SOUMISSIONS
static subscribeSubmissions(callback) {
  console.log('📄 Abonnement aux soumissions...');
  
  const q = query(collection(db, 'soumissions'), orderBy('createdAt', 'desc'));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const submissions = [];
    const seenIds = new Set();
    
    snapshot.forEach((doc) => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        const data = doc.data();
        
        // ✅ SIMPLE : Utiliser folderId directement ou fallback
        let folderId = data.folderId;
        if (!folderId) {
          // Migration de dernière chance pour les anciennes données
          if (data.status === 'assignment') folderId = 'assignments';
          else if (data.status === 'captured') folderId = 'pending';
          else if (data.status === 'completed') folderId = 'projet_2025_soumissions';
          else folderId = 'pending'; // Fallback par défaut
        }
        
        submissions.push({
          id: doc.id,
          ...data,
          folderId, // ✅ S'assurer que folderId est toujours présent
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      }
    });
    
    console.log(`✅ ${submissions.length} soumissions synchronisées`);
    callback({ 
      success: true, 
      data: submissions,
      count: submissions.length 
    });
  }, (error) => {
    console.error('❌ Erreur sync soumissions:', error);
    callback({ 
      success: false, 
      error: error.message,
      data: [],
      count: 0
    });
  });
  
  return unsubscribe;
}


  // 🔧 FONCTIONS UTILITAIRES
static createFilterFunction(filter) {
  return (submissions) => {
    if (!filter) return [];
    
    // ✅ SIMPLE : Filtrer uniquement par folderId
    if (filter.type === 'slug' || filter.type === 'folderId') {
      return submissions.filter(s => s.folderId === filter.value);
    }
    
    // Garder le filtre par année pour les dossiers projets
    if (filter.type === 'year') {
      return submissions.filter(s => {
        const year = new Date(s.createdAt).getFullYear();
        return year === filter.value;
      });
    }
    
    return [];
  };
}


  static generateSlug(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static normalizeString(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }


  // 📝 CRUD SOUMISSIONS
static async createSubmission(submissionData, platform = 'unknown') {
  try {
    console.log('📝 Création soumission...');
    
    const dataToSave = {
      ...submissionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      platform,
      folderId: submissionData.folderId || 'pending' // ✅ folderId par défaut
    };
    
    const docRef = await addDoc(collection(db, 'soumissions'), dataToSave);
    
    console.log('✅ Soumission créée:', docRef.id);
    return { 
      success: true, 
      id: docRef.id 
    };
    
  } catch (error) {
    console.error('❌ Erreur création soumission:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

static async createAssignment(assignmentData, platform = 'unknown') {
  return this.createSubmission({
    ...assignmentData,
    folderId: 'assignments' // ✅ Directement dans assignments
  }, platform);
}

static async updateSubmission(submissionId, updateData) {
  try {
    console.log('✏️ Mise à jour soumission:', submissionId);
    
    const submissionRef = doc(db, 'soumissions', submissionId);
    await updateDoc(submissionRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Soumission mise à jour');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Erreur mise à jour soumission:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}


  static async deleteSubmission(submissionId) {
    try {
      console.log('🗑️ Suppression soumission:', submissionId);
      
      await deleteDoc(doc(db, 'soumissions', submissionId));
      
      console.log('✅ Soumission supprimée');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 📸 GESTION DES PHOTOS
  static async uploadPhotos(submissionId, photosList, onProgress = null) {
    const uploadedUrls = [];
    const errors = [];
    const PARALLEL_UPLOADS = 2;
    
    console.log(`📸 Upload de ${photosList.length} photos...`);
    
    if (onProgress) {
      onProgress({
        visible: true,
        currentPhoto: 0,
        totalPhotos: photosList.length,
        percentage: 0,
        status: 'Préparation...',
        errors: [],
        startTime: Date.now()
      });
    }
    
    // Upload par chunks
    for (let i = 0; i < photosList.length; i += PARALLEL_UPLOADS) {
      const chunk = photosList.slice(i, i + PARALLEL_UPLOADS);
      const chunkPromises = chunk.map(async (photo, chunkIndex) => {
        const index = i + chunkIndex;
        
        try {
          // Vérifier si déjà uploadée
          if (photo.uri?.startsWith('https://firebasestorage.googleapis.com')) {
            return { success: true, url: photo.uri };
          }
          
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 8);
          const photoName = `${submissionId}_photo_${index}_${timestamp}_${randomId}.jpg`;
          const storageRef = ref(storage, `soumissions/${submissionId}/${photoName}`);
          
          const response = await fetch(photo.uri);
          const blob = await response.blob();
          
          await uploadBytes(storageRef, blob);
          const downloadUrl = await getDownloadURL(storageRef);
          
          return { success: true, url: downloadUrl };
          
        } catch (error) {
          console.error(`❌ Erreur photo ${index + 1}:`, error);
          return { 
            success: false, 
            error: `Photo ${index + 1}: ${error.message}` 
          };
        }
      });
      
      const results = await Promise.all(chunkPromises);
      
      results.forEach((result, chunkIndex) => {
        const actualIndex = i + chunkIndex;
        
        if (result.success) {
          uploadedUrls.push(result.url);
        } else {
          errors.push(result.error);
        }
        
        if (onProgress) {
          const completedCount = actualIndex + 1;
          const percentage = Math.round((completedCount / photosList.length) * 100);
          
          onProgress({
            visible: true,
            currentPhoto: completedCount,
            totalPhotos: photosList.length,
            percentage,
            status: `Upload ${completedCount}/${photosList.length}...`,
            errors
          });
        }
      });
    }
    
    if (onProgress) {
      setTimeout(() => {
        onProgress({ visible: false });
      }, 2000);
    }
    
    return {
      uploadedUrls,
      errors,
      success: errors.length === 0,
      stats: {
        total: photosList.length,
        uploaded: uploadedUrls.length,
        failed: errors.length
      }
    };
  }

  // 📁 CRUD DOSSIERS (Desktop seulement)
  static async createFolder(folderData, platform = 'unknown') {
    // Vérifier la plateforme
    const isMobile = typeof window !== 'undefined' && 
                     window.navigator && 
                     /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent);
    
    if (isMobile || platform === 'mobile') {
      console.warn('⚠️ Création de dossiers non autorisée sur mobile');
      return { 
        success: false, 
        error: 'Les dossiers ne peuvent être créés que sur Desktop' 
      };
    }
    
    try {
      console.log('📁 Création dossier:', folderData.label);
      
      const slug = this.generateSlug(folderData.label);
      const folderRef = doc(db, 'folders', slug);
      
      await setDoc(folderRef, {
        ...folderData,
        id: slug,
        slug,
        type: 'custom',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        platform
      });
      
      console.log('✅ Dossier créé:', slug);
      return { 
        success: true, 
        id: slug 
      };
      
    } catch (error) {
      console.error('❌ Erreur création dossier:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  static async updateFolder(folderId, updateData, platform = 'unknown') {
    // Même vérification plateforme
    const isMobile = typeof window !== 'undefined' && 
                     window.navigator && 
                     /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent);
    
    if (isMobile || platform === 'mobile') {
      console.warn('⚠️ Modification de dossiers non autorisée sur mobile');
      return { 
        success: false, 
        error: 'Les dossiers ne peuvent être modifiés que sur Desktop' 
      };
    }
    
    try {
      const folderRef = doc(db, 'folders', folderId);
      await updateDoc(folderRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  static async deleteFolder(folderId, platform = 'unknown') {
    // Vérifier qu'on ne supprime pas un dossier système
    if (Object.values(this.SYSTEM_FOLDERS).some(f => f.slug === folderId)) {
      return { 
        success: false, 
        error: 'Impossible de supprimer un dossier système' 
      };
    }
    
    try {
      await deleteDoc(doc(db, 'folders', folderId));
      return { success: true };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

export default FirebaseSync;