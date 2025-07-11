// folderSyncFunctions.js - Synchronisation des dossiers mobile ↔ desktop
// ✅ AVEC CORRESPONDANCE ICÔNES MOBILE ↔ DESKTOP
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

// 🎯 TABLE DE CORRESPONDANCE ICÔNES MOBILE ↔ DESKTOP
export const ICON_MAPPING = {
  // FontAwesome5 (Mobile) → Lucide (Desktop)
  'folder': 'Folder',
  'folder-open': 'FolderOpen', 
  'file-text': 'FileText',
  'clipboard-list': 'FileText',
  'clock': 'Clock',
  'check-circle': 'CheckCircle2',
  'file-contract': 'FileCheck',
  'tools': 'Wrench',
  'search': 'Search',
  'home': 'Home',
  'cog': 'Settings',
  'chart-bar': 'BarChart3',
  'calendar': 'Calendar',
  'user': 'User',
  'users': 'Users',
  'tag': 'Tag',
  'tags': 'Tags',
  'building': 'Building2',
  'calculator': 'Calculator',
  'eye': 'Eye',
  'edit': 'Edit2',
  'trash': 'Trash2',
  'plus': 'Plus',
  'folder-plus': 'FolderPlus'
};

// 🔄 CORRESPONDANCE INVERSE DESKTOP → MOBILE
export const REVERSE_ICON_MAPPING = Object.fromEntries(
  Object.entries(ICON_MAPPING).map(([mobile, desktop]) => [desktop, mobile])
);

// 🎨 Couleurs disponibles pour les dossiers (cohérence mobile ↔ desktop)
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
  'clipboard-list',
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

// 💻 Icônes disponibles pour desktop (Lucide React)
export const AVAILABLE_FOLDER_ICONS_DESKTOP = [
  'Folder',
  'FolderOpen',
  'FileText',
  'Clock',
  'CheckCircle2',
  'FileCheck', 
  'Wrench',
  'Search',
  'Home',
  'Building2',
  'Calculator',
  'BarChart3',
  'Eye',
  'Settings'
];

// 🔄 FONCTIONS DE CONVERSION ICÔNES

// Convertir icône mobile → desktop
export const convertIconMobileToDesktop = (mobileIcon) => {
  return ICON_MAPPING[mobileIcon] || 'Folder';
};

// Convertir icône desktop → mobile  
export const convertIconDesktopToMobile = (desktopIcon) => {
  return REVERSE_ICON_MAPPING[desktopIcon] || 'folder';
};

// 💾 Sauvegarder un dossier dans Firebase
export const saveFolderToFirebase = async (folderData, platform = 'mobile') => {
  try {
    console.log('💾 Sauvegarde dossier:', folderData.label, 'depuis', platform);
    
    // ID personnalisé basé sur le label
    const customId = `folder_${folderData.label
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30)}_${Date.now()}`;

    // ✅ NORMALISER L'ICÔNE SELON LA PLATEFORME
    let normalizedIcon;
    if (platform === 'mobile') {
      // Mobile envoie FontAwesome → Sauvegarder en FontAwesome
      normalizedIcon = folderData.icon;
    } else {
      // Desktop envoie Lucide → Convertir en FontAwesome pour cohérence
      normalizedIcon = convertIconDesktopToMobile(folderData.icon);
    }

    const dataToSave = {
      ...folderData,
      id: customId,
      icon: normalizedIcon, // ✅ Toujours sauvegarder en format mobile (FontAwesome)
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      platform: platform,
      syncedAt: serverTimestamp()
    };

    const docRef = doc(db, 'folders', customId);
    await setDoc(docRef, dataToSave);
    
    console.log('✅ Dossier sauvé avec ID:', customId, '| Icône normalisée:', normalizedIcon);
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
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      folders.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });

    console.log(`✅ ${folders.length} dossiers récupérés`);
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
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        folders.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      });
      
      console.log(`🔄 Sync dossiers temps réel: ${folders.length} dossiers`);
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
    
    // ✅ NORMALISER L'ICÔNE SI PRÉSENTE
    let normalizedUpdateData = { ...updateData };
    if (updateData.icon) {
      if (platform === 'mobile') {
        // Mobile envoie FontAwesome → OK
        normalizedUpdateData.icon = updateData.icon;
      } else {
        // Desktop envoie Lucide → Convertir
        normalizedUpdateData.icon = convertIconDesktopToMobile(updateData.icon);
      }
    }
    
    const updatePayload = {
      ...normalizedUpdateData,
      updatedAt: serverTimestamp(),
      lastModifiedBy: platform,
      syncedAt: serverTimestamp()
    };

    const folderRef = doc(db, 'folders', folderId);
    await updateDoc(folderRef, updatePayload);

    console.log('✅ Dossier mis à jour | Icône normalisée:', normalizedUpdateData.icon);
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

// 🔗 Fusionner dossiers par défaut + dossiers Firebase (AVEC CONVERSION ICÔNES)
export const mergeFoldersWithDefaults = (defaultFolders, firebaseFolders, platform = 'mobile') => {
  const mergedFolders = { ...defaultFolders };
  
  // Ajouter les dossiers Firebase personnalisés
  firebaseFolders.forEach(folder => {
    // ✅ CONVERTIR L'ICÔNE SELON LA PLATEFORME
    let displayIcon;
    if (platform === 'mobile') {
      // Mobile : utiliser l'icône Firebase telle quelle (FontAwesome)
      displayIcon = folder.icon;
    } else {
      // Desktop : convertir FontAwesome → Lucide
      displayIcon = convertIconMobileToDesktop(folder.icon);
    }

    mergedFolders[folder.id] = {
      ...folder,
      icon: displayIcon, // ✅ Icône adaptée à la plateforme
      isDefault: false,
      // Ajouter les classes de couleur pour cohérence (desktop seulement)
      ...(platform === 'desktop' && {
        bgColor: `bg-${folder.color}-50`,
        textColor: `text-${folder.color}-700`,
        borderColor: `border-${folder.color}-200`,
        iconColor: `text-${folder.color}-600`,
        badgeColor: `bg-${folder.color}-100 text-${folder.color}-800`,
      })
    };
  });
  
  return mergedFolders;
};

console.log('🗂️ Module Sync Dossiers chargé - Mobile ↔ Desktop AVEC CORRESPONDANCE ICÔNES');