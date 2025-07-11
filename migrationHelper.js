// migrationHelper.js - Migration Douce vers Système Centralisé
// 🔄 Permet de migrer sans perdre les données existantes

import { initializeCentralizedFolders, getAllCentralizedFolders } from './centralizedFolderSystem';
import { getAllFoldersFromFirebase, saveFolderToFirebase } from './folderSyncFunctions';

// 🚀 FONCTION PRINCIPALE DE MIGRATION
export const migrateToFCentralizedSystem = async (platform = 'mobile') => {
  try {
    console.log(`🔄 Début migration vers système centralisé (${platform})...`);
    
    // 1️⃣ ÉTAPE 1 : Initialiser la nouvelle structure
    const initResult = await initializeCentralizedFolders(platform);
    
    if (!initResult.success) {
      throw new Error(`Erreur initialisation: ${initResult.error}`);
    }
    
    // 2️⃣ ÉTAPE 2 : Récupérer les dossiers utilisateur existants
    const existingUserFolders = await getExistingUserFolders();
    
    // 3️⃣ ÉTAPE 3 : Migrer les dossiers utilisateur si nécessaire
    let migratedFolders = [];
    if (existingUserFolders.length > 0) {
      console.log(`📦 Migration de ${existingUserFolders.length} dossiers utilisateur...`);
      migratedFolders = await migrateUserFolders(existingUserFolders, platform);
    }
    
    // 4️⃣ ÉTAPE 4 : Récupérer la structure finale
    const finalFolders = await getAllCentralizedFolders();
    
    const migrationResult = {
      success: true,
      isFirstInstall: initResult.isFirstInit,
      totalFolders: finalFolders.length,
      systemFolders: finalFolders.filter(f => f.isSystemFolder).length,
      userFolders: finalFolders.filter(f => !f.isSystemFolder).length,
      migratedFolders: migratedFolders.length,
      folders: finalFolders
    };
    
    console.log('✅ Migration terminée avec succès !', {
      total: migrationResult.totalFolders,
      système: migrationResult.systemFolders,
      utilisateur: migrationResult.userFolders
    });
    
    return migrationResult;
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    return {
      success: false,
      error: error.message,
      folders: []
    };
  }
};

// 📁 RÉCUPÉRER LES DOSSIERS UTILISATEUR EXISTANTS
const getExistingUserFolders = async () => {
  try {
    // Récupérer les dossiers depuis l'ancien système
    const oldFolders = await getAllFoldersFromFirebase();
    
    if (!oldFolders.success) {
      return [];
    }
    
    // Filtrer seulement les dossiers utilisateur (non-système)
    const userFolders = oldFolders.data.filter(folder => {
      // Les dossiers utilisateur n'ont pas le flag isSystemFolder ou l'ont à false
      return !folder.isSystemFolder && !folder.id.startsWith('system_');
    });
    
    console.log(`📋 ${userFolders.length} dossiers utilisateur trouvés dans l'ancien système`);
    return userFolders;
    
  } catch (error) {
    console.error('❌ Erreur récupération dossiers utilisateur:', error);
    return [];
  }
};

// 🔄 MIGRER LES DOSSIERS UTILISATEUR
const migrateUserFolders = async (userFolders, platform) => {
  const migratedFolders = [];
  
  try {
    for (const folder of userFolders) {
      // Préparer le dossier pour le nouveau système
      const migratedFolder = {
        id: folder.id.startsWith('folder_') ? folder.id : `user_${folder.id}`,
        label: folder.label,
        icon: folder.icon,
        color: folder.color || '#3b82f6',
        order: folder.order || 999,
        level: folder.level || 0,
        parentId: folder.parentId,
        isSystemFolder: false,
        isDeletable: true,
        isEditable: true,
        description: folder.description || `Dossier personnalisé: ${folder.label}`,
        // Conserver le filtre s'il existe, sinon créer un filtre custom
        filterConfig: folder.filterConfig || {
          type: 'simple',
          field: 'folderId',
          value: folder.id,
          logic: 'equals'
        },
        // Metadata de migration
        migratedAt: new Date().toISOString(),
        migratedFrom: 'legacy_system',
        originalId: folder.id
      };
      
      // Sauvegarder dans le nouveau système
      const saveResult = await saveFolderToFirebase(migratedFolder, platform);
      
      if (saveResult.success) {
        migratedFolders.push(migratedFolder);
        console.log(`✅ Dossier migré: ${folder.label}`);
      } else {
        console.error(`❌ Échec migration dossier: ${folder.label}`, saveResult.error);
      }
    }
    
    return migratedFolders;
    
  } catch (error) {
    console.error('❌ Erreur migration dossiers utilisateur:', error);
    return migratedFolders; // Retourner ce qui a pu être migré
  }
};

// 🔍 DÉTECTION DU TYPE DE SYSTÈME ACTUEL
export const detectCurrentSystem = async () => {
  try {
    // Vérifier s'il y a des dossiers système dans Firebase
    const folders = await getAllCentralizedFolders();
    const systemFolders = folders.filter(f => f.isSystemFolder);
    
    if (systemFolders.length > 0) {
      return {
        type: 'centralized',
        description: 'Système centralisé déjà en place',
        systemFolders: systemFolders.length,
        totalFolders: folders.length,
        needsMigration: false
      };
    }
    
    // Vérifier s'il y a des dossiers dans l'ancien système
    const oldFolders = await getAllFoldersFromFirebase();
    if (oldFolders.success && oldFolders.data.length > 0) {
      return {
        type: 'legacy',
        description: 'Ancien système avec dossiers utilisateur',
        userFolders: oldFolders.data.length,
        needsMigration: true
      };
    }
    
    // Aucun dossier trouvé = première installation
    return {
      type: 'fresh',
      description: 'Première installation',
      needsMigration: false,
      isFirstInstall: true
    };
    
  } catch (error) {
    console.error('❌ Erreur détection système:', error);
    return {
      type: 'unknown',
      description: 'Impossible de déterminer le type de système',
      error: error.message
    };
  }
};

// 🧹 NETTOYAGE POST-MIGRATION (OPTIONNEL)
export const cleanupAfterMigration = async (dryRun = true) => {
  try {
    console.log(`🧹 ${dryRun ? 'SIMULATION' : 'EXÉCUTION'} nettoyage post-migration...`);
    
    // Identifier les anciens dossiers à nettoyer
    const oldFolders = await getAllFoldersFromFirebase();
    const toCleanup = oldFolders.data.filter(folder => 
      !folder.isSystemFolder && !folder.id.startsWith('system_')
    );
    
    if (dryRun) {
      console.log(`📋 ${toCleanup.length} dossiers seraient supprimés:`, 
        toCleanup.map(f => f.label)
      );
      return {
        success: true,
        dryRun: true,
        foldersToCleanup: toCleanup.length,
        details: toCleanup
      };
    }
    
    // Suppression réelle (à implémenter si nécessaire)
    console.log('⚠️ Nettoyage réel non implémenté par sécurité');
    
    return {
      success: true,
      cleaned: 0,
      message: 'Nettoyage différé pour sécurité'
    };
    
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 📊 RAPPORT DE MIGRATION
export const getMigrationReport = async () => {
  try {
    const systemInfo = await detectCurrentSystem();
    const allFolders = await getAllCentralizedFolders();
    
    const report = {
      timestamp: new Date().toISOString(),
      systemType: systemInfo.type,
      systemDescription: systemInfo.description,
      folders: {
        total: allFolders.length,
        system: allFolders.filter(f => f.isSystemFolder).length,
        user: allFolders.filter(f => !f.isSystemFolder).length
      },
      structure: allFolders.map(folder => ({
        id: folder.id,
        label: folder.label,
        type: folder.isSystemFolder ? 'system' : 'user',
        level: folder.level,
        parentId: folder.parentId
      })),
      recommendations: generateRecommendations(systemInfo, allFolders)
    };
    
    return {
      success: true,
      report
    };
    
  } catch (error) {
    console.error('❌ Erreur génération rapport:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 💡 GÉNÉRER RECOMMANDATIONS
const generateRecommendations = (systemInfo, folders) => {
  const recommendations = [];
  
  if (systemInfo.type === 'legacy') {
    recommendations.push({
      type: 'migration',
      priority: 'high',
      message: 'Migration vers système centralisé recommandée',
      action: 'Exécuter migrateToFCentralizedSystem()'
    });
  }
  
  if (folders.length > 50) {
    recommendations.push({
      type: 'performance',
      priority: 'medium',
      message: 'Nombre élevé de dossiers détecté',
      action: 'Considérer archivage des anciens dossiers'
    });
  }
  
  const userFolders = folders.filter(f => !f.isSystemFolder);
  if (userFolders.length === 0) {
    recommendations.push({
      type: 'usage',
      priority: 'low',
      message: 'Aucun dossier personnalisé créé',
      action: 'Les utilisateurs peuvent créer des dossiers personnalisés'
    });
  }
  
  return recommendations;
};

console.log('🔄 Helper de Migration Firebase Centralisé initialisé');
export default {
  migrateToFCentralizedSystem,
  detectCurrentSystem,
  cleanupAfterMigration,
  getMigrationReport
};