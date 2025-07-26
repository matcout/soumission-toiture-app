// debugFirebase.js - Diagnostic de l'état Firebase
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

async function debugFirebaseState() {
  console.log('🔍 DIAGNOSTIC FIREBASE\n');
  console.log('='.repeat(50));
  
  // 1. Lister tous les dossiers
  console.log('\n📁 DOSSIERS:');
  console.log('-'.repeat(30));
  const foldersSnap = await getDocs(collection(db, 'folders'));
  const folders = [];
  
  foldersSnap.forEach(doc => {
    const data = doc.data();
    folders.push({ id: doc.id, ...data });
    console.log(`ID: ${doc.id}`);
    console.log(`  Label: "${data.label}"`);
    console.log(`  Slug: ${data.slug || 'MANQUANT'}`);
    console.log(`  Parent: ${data.parentId || 'aucun'}`);
    console.log(`  Type: ${data.type || 'custom'}`);
    console.log('');
  });
  
  // 2. Compter les soumissions
  console.log('\n📄 SOUMISSIONS:');
  console.log('-'.repeat(30));
  const submissionsSnap = await getDocs(collection(db, 'soumissions'));
  const stats = {
    total: 0,
    parStatus: {},
    parFolderSlug: {},
    sansSlug: 0
  };
  
  submissionsSnap.forEach(doc => {
    const data = doc.data();
    stats.total++;
    
    // Par status
    const status = data.status || 'sans_status';
    stats.parStatus[status] = (stats.parStatus[status] || 0) + 1;
    
    // Par folderSlug
    if (data.folderSlug) {
      stats.parFolderSlug[data.folderSlug] = (stats.parFolderSlug[data.folderSlug] || 0) + 1;
    } else {
      stats.sansSlug++;
    }
  });
  
  console.log(`Total: ${stats.total} soumissions`);
  console.log('\nPar status:');
  Object.entries(stats.parStatus).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });
  
  console.log('\nPar folderSlug:');
  Object.entries(stats.parFolderSlug).forEach(([slug, count]) => {
    console.log(`  - ${slug}: ${count}`);
  });
  console.log(`  - SANS folderSlug: ${stats.sansSlug}`);
  
  // 3. Identifier les problèmes
  console.log('\n⚠️  PROBLÈMES DÉTECTÉS:');
  console.log('-'.repeat(30));
  
  // Dossiers dupliqués
  const labelCounts = {};
  folders.forEach(f => {
    labelCounts[f.label] = (labelCounts[f.label] || 0) + 1;
  });
  
  let problemCount = 0;
  Object.entries(labelCounts).forEach(([label, count]) => {
    if (count > 1) {
      console.log(`❌ Dossier dupliqué: "${label}" (${count} fois)`);
      problemCount++;
    }
  });
  
  // Dossiers orphelins
  folders.forEach(f => {
    if (f.parentId && !folders.find(p => p.id === f.parentId)) {
      console.log(`❌ Dossier orphelin: "${f.label}" (parent manquant: ${f.parentId})`);
      problemCount++;
    }
  });
  
  // Dossiers sans slug
  folders.forEach(f => {
    if (!f.slug) {
      console.log(`❌ Dossier sans slug: "${f.label}" (ID: ${f.id})`);
      problemCount++;
    }
  });
  
  if (problemCount === 0) {
    console.log('✅ Aucun problème détecté !');
  } else {
    console.log(`\n🔥 ${problemCount} problèmes à corriger`);
  }
  
  console.log('\n' + '='.repeat(50));
}

// Exécuter automatiquement
debugFirebaseState().catch(console.error);