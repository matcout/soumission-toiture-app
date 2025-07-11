// centralizedFolderSystem.js - Système de Dossiers Centralisé Firebase
// 🔥 REMPLACE les DEFAULT_FOLDERS hardcodées par une gestion centralisée

import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

// 🏗️ CONFIGURATION SYSTÈME CENTRALISÉE
const SYSTEM_FOLDER_TEMPLATES = {
  assignments: {
    id: 'system_assignments',
    label: 'Aller prendre mesure',
    icon: 'clipboard-list', // FontAwesome5 format (sera converti selon plateforme)
    color: '#3b82f6',
    order: 0,
    level: 0,
    parentId: null,
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true, // On peut modifier le nom/couleur mais pas supprimer
    filterConfig: {
      type: 'status',
      value: 'assignment',
      logic: 'equals'
    },
    description: 'Dossier système pour les assignments à effectuer sur le terrain'
  },
  
  pending: {
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
    },
    description: 'Soumissions capturées qui nécessitent des calculs'
  },
  
  completed: {
    id: 'system_completed',
    label: 'Terminées',
    icon: 'check-circle',
    color: '#10b981',
    order: 2,
    level: 0,
    parentId: null,
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    filterConfig: {
      type: 'status',
      value: 'completed',
      logic: 'equals'
    },
    description: 'Soumissions complètement terminées'
  },
  
  project2025: {
    id: 'system_project2025',
    label: 'Projet 2025',
    icon: 'folder-open',
    color: '#059669',
    order: 3,
    level: 0,
    parentId: null,
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    isExpandable: true,
    filterConfig: {
      type: 'complex',
      conditions: [
        { field: 'year', value: '2025', logic: 'equals' },
        { field: 'status', value: 'completed', logic: 'equals' }
      ],
      logic: 'AND'
    },
    description: 'Projet principal pour l\'année 2025'
  },
  
  contracts2025: {
    id: 'system_contracts2025',
    label: 'Contrats',
    icon: 'file-contract',
    color: '#8b5cf6',
    order: 0,
    level: 1,
    parentId: 'system_project2025',
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    filterConfig: {
      type: 'complex',
      conditions: [
        { field: 'category', value: 'contrats', logic: 'equals' },
        { field: 'year', value: '2025', logic: 'equals' }
      ],
      logic: 'AND'
    },
    description: 'Contrats signés pour 2025'
  },
  
  submissions2025: {
    id: 'system_submissions2025',
    label: 'Soumissions',
    icon: 'clipboard-list',
    color: '#3b82f6',
    order: 1,
    level: 1,
    parentId: 'system_project2025',
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    filterConfig: {
      type: 'complex',
      conditions: [
        { field: 'category', value: 'soumissions', logic: 'equals' },
        { field: 'year', value: '2025', logic: 'equals' }
      ],
      logic: 'AND'
    },
    description: 'Soumissions en cours pour 2025'
  },
  
  realized2025: {
    id: 'system_realized2025',
    label: 'Réalisé',
    icon: 'check-circle',
    color: '#10b981',
    order: 2,
    level: 1,
    parentId: 'system_project2025',
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    filterConfig: {
      type: 'complex',
      conditions: [
        { field: 'category', value: 'realiser', logic: 'equals' },
        { field: 'year', value: '2025', logic: 'equals' }
      ],
      logic: 'AND'
    },
    description: 'Projets réalisés en 2025'
  },
  
  inspections2025: {
    id: 'system_inspections2025',
    label: 'Inspections',
    icon: 'search',
    color: '#6366f1',
    order: 3,
    level: 1,
    parentId: 'system_project2025',
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    filterConfig: {
      type: 'complex',
      conditions: [
        { field: 'category', value: 'inspections', logic: 'equals' },
        { field: 'year', value: '2025', logic: 'equals' }
      ],
      logic: 'AND'
    },
    description: 'Inspections programmées pour 2025'
  },
  
  repairs2025: {
    id: 'system_repairs2025',
    label: 'Réparations',
    icon: 'tools',
    color: '#f59e0b',
    order: 4,
    level: 1,
    parentId: 'system_project2025',
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    filterConfig: {
      type: 'complex',
      conditions: [
        { field: 'category', value: 'reparations', logic: 'equals' },
        { field: 'year', value: '2025', logic: 'equals' }
      ],
      logic: 'AND'
    },
    description: 'Réparations à effectuer en 2025'
  },
  
  project2024: {
    id: 'system_project2024',
    label: 'Projet 2024',
    icon: 'folder',
    color: '#6b7280',
    order: 4,
    level: 0,
    parentId: null,
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    isExpandable: true,
    filterConfig: {
      type: 'simple',
      field: 'year',
      value: '2024',
      logic: 'equals'
    },
    description: 'Archive des projets 2024'
  },
  
  contracts2024: {
    id: 'system_contracts2024',
    label: 'Contrats 2024',
    icon: 'file-contract',
    color: '#6b7280',
    order: 0,
    level: 1,
    parentId: 'system_project2024',
    isSystemFolder: true,
    isDeletable: false,
    isEditable: true,
    filterConfig: {
      type: 'complex',
      conditions: [
        { field: 'category', value: 'contrats', logic: 'equals' },
        { field: 'year', value: '2024', logic: 'equals' }
      ],
      logic: 'AND'
    },
    description: 'Contrats de l\'année 2024'
  }
};

// 🚀 FONCTION PRINCIPALE D'INITIALISATION
export const initializeCentralizedFolders = async (platform = 'mobile') => {
  try {
    console.log(`🔥 Initialisation dossiers centralisés depuis ${platform}...`);
    
    // 1️⃣ Vérifier si les dossiers système existent déjà
    const existingSystemFolders = await getSystemFolders();
    
    if (existingSystemFolders.length === 0) {
      console.log('📁 Première installation - Création structure système...');
      await createSystemFolders(platform);
    } else {
      console.log(`✅ Structure système existante (${existingSystemFolders.length} dossiers)`);
    }
    
    // 2️⃣ Récupérer TOUS les dossiers (système + utilisateur)
    const allFolders = await getAllCentralizedFolders();
    
    console.log(`📋 ${allFolders.length} dossiers chargés depuis Firebase`);
    return {
      success: true,
      folders: allFolders,
      isFirstInit: existingSystemFolders.length === 0
    };
    
  } catch (error) {
    console.error('❌ Erreur initialisation centralisée:', error);
    return {
      success: false,
      error: error.message,
      folders: []
    };
  }
};

// 📁 CRÉER LA STRUCTURE SYSTÈME DANS FIREBASE
const createSystemFolders = async (platform) => {
  const batch = writeBatch(db);
  
  try {
    const folderEntries = Object.entries(SYSTEM_FOLDER_TEMPLATES);
    
    for (const [key, folderTemplate] of folderEntries) {
      const folderData = {
        ...folderTemplate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: platform,
        platform: platform,
        syncedAt: serverTimestamp(),
        version: '1.0.0'
      };
      
      const docRef = doc(db, 'folders', folderTemplate.id);
      batch.set(docRef, folderData);
      
      console.log(`📂 Préparation dossier système: ${folderTemplate.label}`);
    }
    
    // Exécuter le batch
    await batch.commit();
    console.log('✅ Structure système créée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur création structure système:', error);
    throw error;
  }
};

// 📋 RÉCUPÉRER TOUS LES DOSSIERS CENTRALISÉS
export const getAllCentralizedFolders = async () => {
  try {
    const q = query(
      collection(db, 'folders'),
      orderBy('level', 'asc'),
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
    
    return folders;
    
  } catch (error) {
    console.error('❌ Erreur récupération dossiers centralisés:', error);
    return [];
  }
};

// 🔍 RÉCUPÉRER SEULEMENT LES DOSSIERS SYSTÈME
export const getSystemFolders = async () => {
  try {
    const q = query(
      collection(db, 'folders'),
      where('isSystemFolder', '==', true),
      orderBy('order', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const systemFolders = [];
    
    querySnapshot.forEach((doc) => {
      systemFolders.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return systemFolders;
    
  } catch (error) {
    console.error('❌ Erreur récupération dossiers système:', error);
    return [];
  }
};

// 🔄 APPLIQUER LES FILTRES AUX SOUMISSIONS
export const applyFolderFilter = (folder, submissions) => {
  if (!folder.filterConfig || !submissions || submissions.length === 0) {
    return [];
  }
  
  const { filterConfig } = folder;
  
  if (filterConfig.type === 'simple') {
    // Filtre simple : field = value
    return submissions.filter(submission => {
      const fieldValue = getNestedValue(submission, filterConfig.field);
      return compareValues(fieldValue, filterConfig.value, filterConfig.logic);
    });
  }
  
  if (filterConfig.type === 'complex') {
    // Filtre complexe : multiple conditions avec AND/OR
    return submissions.filter(submission => {
      const results = filterConfig.conditions.map(condition => {
        const fieldValue = getNestedValue(submission, condition.field);
        return compareValues(fieldValue, condition.value, condition.logic);
      });
      
      // Appliquer la logique AND/OR
      return filterConfig.logic === 'AND' 
        ? results.every(result => result)
        : results.some(result => result);
    });
  }
  
  if (filterConfig.type === 'status') {
    // Filtre de statut (legacy support)
    return submissions.filter(submission => 
      submission.status === filterConfig.value
    );
  }
  
  return [];
};

// 🛠️ FONCTIONS UTILITAIRES
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
};

const compareValues = (fieldValue, targetValue, logic) => {
  switch (logic) {
    case 'equals':
      return fieldValue === targetValue;
    case 'contains':
      return fieldValue && fieldValue.toString().toLowerCase().includes(targetValue.toLowerCase());
    case 'startsWith':
      return fieldValue && fieldValue.toString().toLowerCase().startsWith(targetValue.toLowerCase());
    case 'exists':
      return fieldValue !== null && fieldValue !== undefined;
    case 'notExists':
      return fieldValue === null || fieldValue === undefined;
    default:
      return false;
  }
};

// 🎛️ FONCTION POUR ADMIN/CONFIGURATION AVANCÉE
export const updateSystemFolderConfig = async (folderId, updates, platform) => {
  try {
    const folderRef = doc(db, 'folders', folderId);
    
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp(),
      lastModifiedBy: platform,
      syncedAt: serverTimestamp()
    };
    
    await updateDoc(folderRef, updateData);
    
    console.log(`✅ Configuration dossier ${folderId} mise à jour`);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Erreur mise à jour config dossier:', error);
    return { success: false, error: error.message };
  }
};

// 📊 STATISTIQUES DES DOSSIERS
export const getFolderStats = async () => {
  try {
    const allFolders = await getAllCentralizedFolders();
    
    const stats = {
      total: allFolders.length,
      system: allFolders.filter(f => f.isSystemFolder).length,
      user: allFolders.filter(f => !f.isSystemFolder).length,
      levels: Math.max(...allFolders.map(f => f.level || 0)) + 1
    };
    
    return { success: true, stats };
    
  } catch (error) {
    console.error('❌ Erreur stats dossiers:', error);
    return { success: false, error: error.message };
  }
};

console.log('🔥 Système de Dossiers Centralisé Firebase initialisé');
export default {
  initializeCentralizedFolders,
  getAllCentralizedFolders,
  getSystemFolders,
  applyFolderFilter,
  updateSystemFolderConfig,
  getFolderStats
};