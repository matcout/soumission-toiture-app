// centralizedFolderSystem.js - Version modifiée SANS dossier Terminées
import { 
  collection, 
  getDocs, 
  query, 
  orderBy,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Configuration des dossiers système (SANS Terminées)
const SYSTEM_FOLDERS = {
  system_assignments: {
    id: 'system_assignments',
    label: 'Aller prendre mesure',
    icon: 'clipboard-list',
    color: '#3b82f6',
    order: 0,
    level: 0,
    parentId: null,
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    filterConfig: {
      type: 'status',
      value: 'assignment',
      logic: 'equals'
    }
  },
  system_pending: {
    id: 'system_pending',
    label: 'À compléter',
    icon: 'clock',
    color: '#f59e0b',
    order: 1,
    level: 0,
    parentId: null,
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    filterConfig: {
      type: 'status',
      value: 'captured',
      logic: 'equals'
    }
  },
  system_project2025: {
    id: 'system_project2025',
    label: 'Projet 2025',
    icon: 'folder-open',
    color: '#059669',
    order: 2,
    level: 0,
    parentId: null,
    isSystemFolder: false, // N'est pas vraiment système
    isDeletable: true,
    isEditable: true,
    isExpandable: true,
    filterConfig: null
  }
};

// Sous-dossier Soumissions pour Projet 2025
const SOUMISSIONS_SUBFOLDER = {
  id: 'projet_2025_soumissions',
  label: 'Soumissions',
  icon: 'file-text',
  color: '#059669',
  order: 0,
  level: 1,
  parentId: 'system_project2025',
  isSystemFolder: false,
  isDeletable: false, // Protégé car requis pour les soumissions terminées
  isEditable: true,
  filterConfig: null
};

// Initialiser le système centralisé
export const initializeCentralizedFolders = async (platform = 'desktop') => {
  try {
    console.log(`🔥 Initialisation système centralisé ${platform}...`);
    
    // Récupérer tous les dossiers depuis Firebase
    const folders = await getAllCentralizedFolders();
    
    // Si aucun dossier, créer la structure par défaut
    if (folders.length === 0) {
      console.log('📁 Création structure système...');
      
      // Créer les dossiers système
      for (const [id, folder] of Object.entries(SYSTEM_FOLDERS)) {
        await createSystemFolder(folder, platform);
      }
      
      // Créer le sous-dossier Soumissions
      await createSystemFolder(SOUMISSIONS_SUBFOLDER, platform);
      
      // Récupérer à nouveau après création
      const newFolders = await getAllCentralizedFolders();
      return {
        success: true,
        folders: newFolders,
        isFirstInit: true
      };
    }
    
    // Vérifier si le sous-dossier Soumissions existe
    const hasSubmissionsFolder = folders.some(f => f.id === 'projet_2025_soumissions');
    if (!hasSubmissionsFolder) {
      console.log('📁 Création du sous-dossier Soumissions...');
      await createSystemFolder(SOUMISSIONS_SUBFOLDER, platform);
    }
    
    return {
      success: true,
      folders: folders,
      isFirstInit: false
    };
    
  } catch (error) {
    console.error('❌ Erreur initialisation:', error);
    // Retourner les dossiers par défaut en cas d'erreur
    return {
      success: true,
      folders: Object.values(SYSTEM_FOLDERS),
      isFirstInit: true,
      offline: true
    };
  }
};

// Créer un dossier système
const createSystemFolder = async (folderData, platform) => {
  try {
    const docRef = doc(db, 'folders', folderData.id);
    await setDoc(docRef, {
      ...folderData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      platform: platform
    }, { merge: true }); // Utiliser merge pour éviter d'écraser
    console.log(`✅ Dossier créé: ${folderData.label}`);
  } catch (error) {
    console.error(`❌ Erreur création dossier ${folderData.label}:`, error);
  }
};

// Récupérer tous les dossiers
export const getAllCentralizedFolders = async () => {
  try {
    const q = query(
      collection(db, 'folders'),
      orderBy('order', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const folders = [];
    
    querySnapshot.forEach((doc) => {
      folders.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return folders;
    
  } catch (error) {
    console.error('❌ Erreur récupération dossiers:', error);
    // Retourner les dossiers par défaut
    return Object.values(SYSTEM_FOLDERS);
  }
};

// Appliquer les filtres
export const applyFolderFilter = (folder, submissions) => {
  if (!folder || !submissions) {
    return [];
  }
  
  // Gérer le filtre pour le sous-dossier Soumissions (reçoit les complétées)
  if (folder.id === 'projet_2025_soumissions') {
    return submissions.filter(s => 
      s.folderId === 'projet_2025_soumissions' || 
      s.status === 'completed'
    );
  }
  
  // Gérer les filtres des dossiers système
  if (folder.filterConfig) {
    const { filterConfig } = folder;
    
    if (filterConfig.type === 'status') {
      return submissions.filter(s => s.status === filterConfig.value);
    }
  }
  
  // Pour les autres dossiers, filtrer par folderId
  return submissions.filter(s => s.folderId === folder.id);
};

// Obtenir le dossier cible pour les soumissions complétées
export const getCompletedSubmissionsFolder = () => {
  return 'projet_2025_soumissions';
};

// Vérifier si un dossier est système
export const isSystemFolder = (folderId) => {
  return SYSTEM_FOLDERS.hasOwnProperty(folderId) && 
         SYSTEM_FOLDERS[folderId].isSystemFolder === true;
};

export default {
  initializeCentralizedFolders,
  getAllCentralizedFolders,
  applyFolderFilter,
  getCompletedSubmissionsFolder,
  isSystemFolder,
  SYSTEM_FOLDERS
};