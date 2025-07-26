// cleanupDuplicates.js
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

// Fonction principale de nettoyage
export async function cleanupDuplicateFolders() {
  console.log('🧹 Début du nettoyage des dossiers en doublon...');
  console.log('📅 Date:', new Date().toLocaleString());
  
  try {
    const foldersSnapshot = await getDocs(collection(db, 'folders'));
    const foldersByLabel = new Map();
    const stats = {
      total: 0,
      duplicates: 0,
      deleted: 0
    };
    
    // 1. Analyser tous les dossiers
    console.log('\n📊 Analyse des dossiers...');
    foldersSnapshot.forEach((doc) => {
      stats.total++;
      const data = doc.data();
      const label = data.label?.toLowerCase().trim();
      
      if (!foldersByLabel.has(label)) {
        foldersByLabel.set(label, []);
      }
      
      foldersByLabel.get(label).push({
        id: doc.id,
        slug: data.slug,
        label: data.label,
        type: data.type,
        createdAt: data.createdAt,
        platform: data.platform,
        docRef: doc.ref
      });
    });
    
    console.log(`✅ ${stats.total} dossiers analysés`);
    
    // 2. Identifier et supprimer les doublons
    console.log('\n🔍 Recherche des doublons...');
    for (const [label, folders] of foldersByLabel) {
      if (folders.length > 1) {
        stats.duplicates += folders.length - 1;
        console.log(`\n📁 Doublons trouvés pour "${label}": ${folders.length} copies`);
        
        // Afficher les détails
        folders.forEach((f, index) => {
          console.log(`   ${index + 1}. ID: ${f.id}`);
          console.log(`      - Slug: ${f.slug || 'aucun'}`);
          console.log(`      - Type: ${f.type || 'custom'}`);
          console.log(`      - Platform: ${f.platform || 'unknown'}`);
        });
        
        // Logique pour choisir celui à garder
        let toKeep = null;
        
        // Priorité 1: Dossier système
        toKeep = folders.find(f => f.type === 'system');
        
        // Priorité 2: Dossier avec slug
        if (!toKeep) {
          toKeep = folders.find(f => f.slug);
        }
        
        // Priorité 3: Le plus ancien (premier créé)
        if (!toKeep) {
          toKeep = folders.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return aTime - bTime;
          })[0];
        }
        
        console.log(`   ✅ Garder: ${toKeep.id} (${toKeep.type || 'custom'})`);
        
        // Supprimer les autres
        const toDelete = folders.filter(f => f.id !== toKeep.id);
        for (const folder of toDelete) {
          console.log(`   🗑️ Suppression: ${folder.id}`);
          await deleteDoc(folder.docRef);
          stats.deleted++;
        }
      }
    }
    
    // 3. Résumé
    console.log('\n📈 RÉSUMÉ DU NETTOYAGE:');
    console.log(`   - Total dossiers analysés: ${stats.total}`);
    console.log(`   - Doublons trouvés: ${stats.duplicates}`);
    console.log(`   - Dossiers supprimés: ${stats.deleted}`);
    console.log(`   - Dossiers restants: ${stats.total - stats.deleted}`);
    
    return {
      success: true,
      stats
    };
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Fonction pour lister tous les dossiers (utile pour debug)
export async function listAllFolders() {
  console.log('\n📋 Liste de tous les dossiers:');
  
  try {
    const foldersSnapshot = await getDocs(collection(db, 'folders'));
    const folders = [];
    
    foldersSnapshot.forEach((doc) => {
      const data = doc.data();
      folders.push({
        id: doc.id,
        label: data.label,
        slug: data.slug,
        type: data.type,
        order: data.order
      });
    });
    
    // Trier par ordre
    folders.sort((a, b) => (a.order || 999) - (b.order || 999));
    
    // Afficher
    folders.forEach((f, index) => {
      console.log(`${index + 1}. ${f.label}`);
      console.log(`   - ID: ${f.id}`);
      console.log(`   - Slug: ${f.slug || 'aucun'}`);
      console.log(`   - Type: ${f.type || 'custom'}`);
      console.log('');
    });
    
    return folders;
    
  } catch (error) {
    console.error('❌ Erreur listing:', error);
    return [];
  }
}

// Fonction pour faire un backup avant nettoyage (optionnel mais recommandé)
export async function backupFolders() {
  console.log('\n💾 Création backup des dossiers...');
  
  try {
    const foldersSnapshot = await getDocs(collection(db, 'folders'));
    const backup = [];
    
    foldersSnapshot.forEach((doc) => {
      backup.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    // Sauvegarder dans AsyncStorage
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(
      'FOLDERS_BACKUP_' + new Date().toISOString(),
      JSON.stringify(backup)
    );
    
    console.log(`✅ Backup créé: ${backup.length} dossiers`);
    return backup;
    
  } catch (error) {
    console.error('❌ Erreur backup:', error);
    return null;
  }
}