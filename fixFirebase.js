// fixFirebase.js - Correction de la structure Firebase
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import FirebaseSync from './firebaseSync';

async function fixFirebaseStructure() {
  console.log('🔧 CORRECTION DE LA STRUCTURE FIREBASE\n');
  console.log('='.repeat(50));
  
  try {
    // 1. Supprimer les doublons
    console.log('\n1️⃣ SUPPRESSION DES DOUBLONS...');
    const foldersSnap = await getDocs(collection(db, 'folders'));
    const foldersByLabel = {};
    
    // Grouper par label
    for (const docSnap of foldersSnap.docs) {
      const data = docSnap.data();
      const label = data.label;
      
      if (!foldersByLabel[label]) {
        foldersByLabel[label] = [];
      }
      foldersByLabel[label].push({ 
        id: docSnap.id, 
        ...data,
        docRef: docSnap.ref 
      });
    }
    
    // Supprimer les doublons
    for (const [label, duplicates] of Object.entries(foldersByLabel)) {
      if (duplicates.length > 1) {
        console.log(`\n  📁 "${label}": ${duplicates.length} copies trouvées`);
        
        // Garder celui avec un slug ou le premier
        const toKeep = duplicates.find(d => d.slug && d.type === 'system') || 
                      duplicates.find(d => d.slug) || 
                      duplicates[0];
        
        console.log(`     Garder: ${toKeep.id} (slug: ${toKeep.slug})`);
        
        for (const dup of duplicates) {
          if (dup.id !== toKeep.id) {
            await deleteDoc(dup.docRef);
            console.log(`     ❌ Supprimé: ${dup.id}`);
          }
        }
      }
    }
    
    // 2. Initialiser les dossiers système
    console.log('\n2️⃣ VÉRIFICATION DES DOSSIERS SYSTÈME...');
    await FirebaseSync.initialize();
    console.log('   ✅ Dossiers système vérifiés');
    
    // 3. Corriger les relations parent-enfant
    console.log('\n3️⃣ CORRECTION DES RELATIONS...');
    
    // S'assurer que "Soumissions" est dans "Projet 2025"
    const soumissionsQuery = query(
      collection(db, 'folders'), 
      where('label', '==', 'Soumissions')
    );
    const soumissionsSnap = await getDocs(soumissionsQuery);
    
    if (!soumissionsSnap.empty) {
      const soumissionDoc = soumissionsSnap.docs[0];
      await updateDoc(soumissionDoc.ref, {
        parentId: 'projet_2025',
        slug: soumissionDoc.data().slug || 'completed',
        order: 0
      });
      console.log('   ✅ "Soumissions" rattaché à "Projet 2025"');
    }
    
    // 4. Attribuer les folderSlug manquants
    console.log('\n4️⃣ ATTRIBUTION DES FOLDERSLUG...');
    const submissionsSnap = await getDocs(collection(db, 'soumissions'));
    let updated = 0;
    
    for (const docSnap of submissionsSnap.docs) {
      const data = docSnap.data();
      
      if (!data.folderSlug) {
        let folderSlug = 'pending'; // Par défaut
        
        // Déterminer le slug selon le status
        if (data.status === 'assignment') {
          folderSlug = 'assignments';
        } else if (data.status === 'captured' || data.status === 'pending') {
          folderSlug = 'pending';
        } else if (data.status === 'completed') {
          folderSlug = 'completed';
        } else if (data.folderName) {
          // Essayer de mapper l'ancien nom
          const normalized = data.folderName.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          
          if (normalized.includes('contrat')) folderSlug = 'contrats';
          else if (normalized.includes('realise')) folderSlug = 'realise';
          else if (normalized.includes('reparation')) folderSlug = 'reparations';
        }
        
        await updateDoc(docSnap.ref, { folderSlug });
        updated++;
        console.log(`   ✅ ${data.client?.adresse || docSnap.id} → ${folderSlug}`);
      }
    }
    
    console.log(`   📊 ${updated} soumissions mises à jour`);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ CORRECTION TERMINÉE !');
    console.log('🔄 Relancez l\'app pour voir les changements');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
  }
}

// Exécuter automatiquement
fixFirebaseStructure().catch(console.error);