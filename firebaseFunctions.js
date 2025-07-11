// firebaseFunctions.js - MOBILE - VERSION AVEC IDS UNIQUES
// Toutes les fonctions Firebase : soumissions + dossiers

import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy,
  where 
} from 'firebase/firestore';
import { db } from './firebase';

// ==========================================
// 📄 FONCTIONS SOUMISSIONS (PRINCIPALES)
// ==========================================

// 🔄 Écouter les soumissions en temps réel
export const subscribeToSubmissions = (callback) => {
  try {
    console.log('📱 Abonnement aux soumissions temps réel...');
    
    const q = query(
      collection(db, 'soumissions'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const submissions = [];
      const seenIds = new Set(); // Pour éviter les doublons
      
      querySnapshot.forEach((doc) => {
        // Vérifier si on a déjà vu cet ID
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          const data = doc.data();
          submissions.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          });
        }
      });
      
      console.log(`🔄 Sync soumissions mobile: ${submissions.length} éléments uniques`);
      callback({
        success: true,
        data: submissions,
        count: submissions.length
      });
    }, (error) => {
      console.error('❌ Erreur écoute soumissions temps réel:', error);
      callback({
        success: false,
        error: error.message,
        data: []
      });
    });
    
    return unsubscribe;
    
  } catch (error) {
    console.error('❌ Erreur abonnement soumissions:', error);
    return null;
  }
};

// 🆕 Fonction pour générer un ID vraiment unique
const generateUniqueId = (prefix = 'submission') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8); // 6 caractères aléatoires
  return `${prefix}_${timestamp}_${random}`;
};

// 💾 Sauvegarder une soumission
export const saveSubmissionToFirebase = async (submissionData) => {
  try {
    console.log('💾 Sauvegarde soumission mobile...');
    
    // Nouveau système d'ID unique
    const addressClean = submissionData.client?.adresse
      ?.toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20) || 'submission';
    
    // Générer un ID vraiment unique
    const customId = generateUniqueId(addressClean);
    
    const dataToSave = {
      ...submissionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      platform: 'mobile',
      status: submissionData.status || 'captured'
    };

    const docRef = doc(db, 'soumissions', customId);
    await setDoc(docRef, dataToSave);
    
    console.log('✅ Soumission sauvée avec ID unique:', customId);
    return {
      success: true,
      id: customId,
      displayName: submissionData.client?.adresse || 'Soumission'
    };

  } catch (error) {
    console.error('❌ Erreur sauvegarde soumission:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 🆕 Créer un assignment depuis le bureau
export const createAssignment = async (assignmentData) => {
  try {
    console.log('📱 Création assignment...');
    
    const addressClean = assignmentData.client?.adresse
      ?.toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20) || 'assignment';
    
    // Utiliser la nouvelle fonction pour ID unique
    const customId = generateUniqueId(`assignment_${addressClean}`);
    
    const dataToSave = {
      ...assignmentData,
      status: 'assignment',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      platform: 'mobile',
      displayName: assignmentData.client?.adresse
    };

    const docRef = doc(db, 'soumissions', customId);
    await setDoc(docRef, dataToSave);
    
    console.log('✅ Assignment créé avec ID unique:', customId);
    return {
      success: true,
      id: customId,
      displayName: assignmentData.client?.adresse
    };

  } catch (error) {
    console.error('❌ Erreur création assignment:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ✏️ Mettre à jour le statut d'une soumission
export const updateSubmissionStatus = async (submissionId, newStatus, additionalData = {}) => {
  try {
    console.log('✏️ Mise à jour soumission:', submissionId);
    
    const updateData = {
      updatedAt: serverTimestamp(),
      lastModifiedBy: 'mobile',
      ...additionalData
    };
    
    if (newStatus) {
      updateData.status = newStatus;
    }

    const submissionRef = doc(db, 'soumissions', submissionId);
    await updateDoc(submissionRef, updateData);

    console.log('✅ Soumission mise à jour');
    return { success: true };

  } catch (error) {
    console.error('❌ Erreur mise à jour soumission:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const updateSubmissionInFirebase = async (submissionId, submissionData) => {
  try {
    console.log('✏️ Mise à jour complète soumission:', submissionId);
    
    const updateData = {
      ...submissionData,
      updatedAt: serverTimestamp(),
      lastModifiedBy: 'mobile'
    };

    const submissionRef = doc(db, 'soumissions', submissionId);
    await updateDoc(submissionRef, updateData);

    console.log('✅ Soumission mise à jour complètement');
    return { success: true };

  } catch (error) {
    console.error('❌ Erreur mise à jour soumission:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const saveSubmission = saveSubmissionToFirebase;

// 🗑️ Supprimer une soumission
export const deleteSubmissionFromFirebase = async (submissionId) => {
  try {
    console.log('🗑️ Suppression soumission:', submissionId);
    
    const docRef = doc(db, 'soumissions', submissionId);
    await deleteDoc(docRef);
    
    console.log('✅ Soumission supprimée');
    return { success: true };

  } catch (error) {
    console.error('❌ Erreur suppression soumission:', error);
    return { success: false, error: error.message };
  }
};

// 📊 Obtenir statistiques
export const getSubmissionStats = async () => {
  try {
    const q = query(collection(db, 'soumissions'));
    const querySnapshot = await getDocs(q);
    
    let total = 0;
    let pending = 0;
    let completed = 0;
    let totalSuperficie = 0;
    let totalPhotos = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      total++;
      
      if (data.status === 'captured') pending++;
      if (data.status === 'completed') completed++;
      
      totalSuperficie += data.toiture?.superficie?.totale || 0;
      totalPhotos += data.photoCount || 0;
    });
    
    return {
      success: true,
      data: {
        total,
        pending,
        completed,
        totalSuperficie: totalSuperficie.toFixed(2),
        totalPhotos
      }
    };
  } catch (error) {
    console.error('❌ Erreur statistiques:', error);
    return { success: false, error: error.message };
  }
};

// 📋 Récupérer toutes les soumissions
export const getAllSubmissions = async () => {
  try {
    console.log('📋 Récupération soumissions...');
    
    const q = query(
      collection(db, 'soumissions'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const submissions = [];
    const seenIds = new Set(); // Pour éviter les doublons
    
    querySnapshot.forEach((doc) => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        const data = doc.data();
        submissions.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      }
    });

    console.log(`✅ ${submissions.length} soumissions uniques récupérées`);
    return {
      success: true,
      data: submissions,
      count: submissions.length
    };

  } catch (error) {
    console.error('❌ Erreur récupération soumissions:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

// ==========================================
// 🗂️ FONCTIONS DOSSIERS (SYNCHRONISATION)
// ==========================================

// 💾 Sauvegarder un dossier dans Firebase
export const saveFolderToFirebase = async (folderData, platform = 'mobile') => {
  try {
    console.log('💾 Sauvegarde dossier:', folderData.label, 'depuis', platform);
    
    // Utiliser la nouvelle fonction pour ID unique
    const folderPrefix = folderData.label
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20);
    
    const customId = generateUniqueId(`folder_${folderPrefix}`);

    const dataToSave = {
      ...folderData,
      id: customId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      platform: platform,
      syncedAt: serverTimestamp()
    };

    const docRef = doc(db, 'folders', customId);
    await setDoc(docRef, dataToSave);
    
    console.log('✅ Dossier sauvé avec ID unique:', customId);
    return {
      success: true,
      id: customId,
      message: `Dossier "${folderData.label}" synchronisé !`
    };

  } catch (error) {
    console.error('❌ Erreur sauvegarde dossier Firebase:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 📋 Récupérer tous les dossiers personnalisés
export const getAllFoldersFromFirebase = async () => {
  try {
    console.log('📋 Récupération des dossiers Firebase...');
    
    const q = query(
      collection(db, 'folders'),
      orderBy('order', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const folders = [];
    const seenIds = new Set(); // Pour éviter les doublons
    
    querySnapshot.forEach((doc) => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        const data = doc.data();
        folders.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      }
    });

    console.log(`✅ ${folders.length} dossiers uniques récupérés`);
    return {
      success: true,
      data: folders,
      count: folders.length
    };

  } catch (error) {
    console.error('❌ Erreur récupération dossiers:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

// 🔄 Écouter les changements de dossiers en temps réel
export const subscribeToFolders = (callback) => {
  try {
    console.log('🔄 Abonnement aux dossiers temps réel...');
    
    const q = query(
      collection(db, 'folders'),
      orderBy('order', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const folders = [];
      const seenIds = new Set(); // Pour éviter les doublons
      
      querySnapshot.forEach((doc) => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          const data = doc.data();
          folders.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          });
        }
      });
      
      console.log(`🔄 Sync dossiers temps réel: ${folders.length} dossiers uniques`);
      callback({
        success: true,
        data: folders,
        count: folders.length
      });
    }, (error) => {
      console.error('❌ Erreur écoute dossiers temps réel:', error);
      callback({
        success: false,
        error: error.message,
        data: []
      });
    });
    
    return unsubscribe;
    
  } catch (error) {
    console.error('❌ Erreur abonnement dossiers:', error);
    return null;
  }
};

// ✏️ Mettre à jour un dossier
export const updateFolderInFirebase = async (folderId, updateData, platform = 'mobile') => {
  try {
    console.log('✏️ Mise à jour dossier:', folderId, 'depuis', platform);
    
    const updatePayload = {
      ...updateData,
      updatedAt: serverTimestamp(),
      lastModifiedBy: platform,
      syncedAt: serverTimestamp()
    };

    const folderRef = doc(db, 'folders', folderId);
    await updateDoc(folderRef, updatePayload);

    console.log('✅ Dossier mis à jour');
    return {
      success: true,
      message: 'Dossier mis à jour et synchronisé'
    };

  } catch (error) {
    console.error('❌ Erreur mise à jour dossier:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 🗑️ Supprimer un dossier
export const deleteFolderFromFirebase = async (folderId) => {
  try {
    console.log('🗑️ Suppression dossier Firebase:', folderId);
    
    const docRef = doc(db, 'folders', folderId);
    await deleteDoc(docRef);
    
    console.log('✅ Dossier supprimé de Firebase');
    return { success: true };

  } catch (error) {
    console.error('❌ Erreur suppression dossier Firebase:', error);
    return { success: false, error: error.message };
  }
};

// 🔗 Fusionner dossiers par défaut + dossiers Firebase
export const mergeFoldersWithDefaults = (defaultFolders, firebaseFolders) => {
  const mergedFolders = { ...defaultFolders };
  const seenIds = new Set(Object.keys(defaultFolders));
  
  // Ajouter les dossiers Firebase personnalisés
  firebaseFolders.forEach(folder => {
    if (!seenIds.has(folder.id)) {
      seenIds.add(folder.id);
      mergedFolders[folder.id] = {
        ...folder,
        isDefault: false,
        bgColor: `bg-${folder.color}-50`,
        textColor: `text-${folder.color}-700`,
        borderColor: `border-${folder.color}-200`,
        iconColor: `text-${folder.color}-600`,
        badgeColor: `bg-${folder.color}-100 text-${folder.color}-800`,
      };
    }
  });
  
  return mergedFolders;
};

// 🎨 Couleurs disponibles pour les dossiers
export const AVAILABLE_FOLDER_COLORS = [
  { name: 'blue', label: 'Bleu', hex: '#3b82f6' },
  { name: 'green', label: 'Vert', hex: '#10b981' },
  { name: 'orange', label: 'Orange', hex: '#f59e0b' },
  { name: 'purple', label: 'Violet', hex: '#8b5cf6' },
  { name: 'red', label: 'Rouge', hex: '#ef4444' },
  { name: 'yellow', label: 'Jaune', hex: '#eab308' },
  { name: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { name: 'emerald', label: 'Émeraude', hex: '#059669' },
  { name: 'pink', label: 'Rose', hex: '#ec4899' },
  { name: 'gray', label: 'Gris', hex: '#6b7280' }
];

// 📱 Icônes disponibles pour mobile (FontAwesome5)
export const AVAILABLE_FOLDER_ICONS_MOBILE = [
  'folder',
  'folder-open', 
  'file-text',
  'clock',
  'check-circle',
  'file-contract',
  'tools',
  'search',
  'home',
  'cog',
  'chart-bar',
  'calendar',
  'user',
  'users',
  'tag',
  'tags'
];

console.log('🔥 Firebase Functions Mobile avec IDS UNIQUES initialisées');