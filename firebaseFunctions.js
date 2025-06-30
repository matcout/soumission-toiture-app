// 2. MODIFIEZ votre fichier firebaseFunctions.js :

import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// 💾 Sauvegarder avec nom personnalisé basé sur l'adresse
export const saveSubmissionToFirebase = async (submissionData) => {
  try {
    const address = submissionData.client?.adresse || 'projet_sans_adresse';
    console.log('💾 Sauvegarde en cours...', address);
    
    // Créer un ID lisible basé sur l'adresse + timestamp
// NOUVEAU CODE - Option 1 :
const customId = address
  .toLowerCase()
  .replace(/[^a-zA-Z0-9\s]/g, '') // Enlever caractères spéciaux
  .replace(/\s+/g, '_') // Remplacer espaces par underscore
  .substring(0, 60); // Limiter à 60 caractères pour Firestore

    // Préparer les données avec timestamp
    const dataToSave = {
      ...submissionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      customId: customId,
      displayName: address // Nom d'affichage lisible
    };

    // 🔥 Utiliser setDoc avec ID personnalisé au lieu d'addDoc
    const docRef = doc(db, 'soumissions', customId);
    await setDoc(docRef, dataToSave);
    
    console.log('✅ Soumission sauvée avec ID personnalisé:', customId);
    return {
      success: true,
      id: customId,
      displayName: address,
      message: `Soumission "${address}" sauvée dans le cloud !`
    };

  } catch (error) {
    console.error('❌ Erreur sauvegarde Firebase:', error);
    return {
      success: false,
      error: error.message,
      message: 'Erreur sauvegarde cloud'
    };
  }
};

// Le reste de vos fonctions reste identique...
export const getAllSubmissions = async () => {
  try {
    console.log('📋 Récupération des soumissions...');
    
    const querySnapshot = await getDocs(collection(db, 'soumissions'));
    const submissions = [];
    
    querySnapshot.forEach((doc) => {
      submissions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Trier par date (plus récent en premier)
    submissions.sort((a, b) => {
      const dateA = a.createdAt?.toDate() || new Date(0);
      const dateB = b.createdAt?.toDate() || new Date(0);
      return dateB - dateA;
    });

    console.log(`✅ ${submissions.length} soumissions récupérées`);
    return {
      success: true,
      data: submissions,
      count: submissions.length
    };

  } catch (error) {
    console.error('❌ Erreur récupération:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

// Les autres fonctions restent identiques...
export const updateSubmissionInFirebase = async (submissionId, updatedData) => {
  try {
    console.log('🔄 Mise à jour soumission:', submissionId);
    
    const submissionRef = doc(db, 'soumissions', submissionId);
    await updateDoc(submissionRef, {
      ...updatedData,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Soumission mise à jour');
    return {
      success: true,
      message: 'Soumission mise à jour dans le cloud'
    };

  } catch (error) {
    console.error('❌ Erreur mise à jour:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const deleteSubmissionFromFirebase = async (submissionId) => {
  try {
    console.log('🗑️ Suppression soumission:', submissionId);
    
    await deleteDoc(doc(db, 'soumissions', submissionId));
    
    console.log('✅ Soumission supprimée');
    return {
      success: true,
      message: 'Soumission supprimée du cloud'
    };

  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const getSubmissionStats = async () => {
  try {
    const result = await getAllSubmissions();
    
    if (result.success) {
      const submissions = result.data;
      const totalSuperficie = submissions.reduce((sum, sub) => {
        return sum + (sub.toiture?.superficie?.totale || 0);
      }, 0);

      return {
        total: submissions.length,
        totalSuperficie: totalSuperficie.toFixed(2),
        lastMonth: submissions.filter(sub => {
          const date = sub.createdAt?.toDate() || new Date(0);
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return date > monthAgo;
        }).length
      };
    }

    return { total: 0, totalSuperficie: '0', lastMonth: 0 };

  } catch (error) {
    console.error('❌ Erreur stats:', error);
    return { total: 0, totalSuperficie: '0', lastMonth: 0 };
  }
};

export const searchSubmissions = async (searchTerm) => {
  try {
    const result = await getAllSubmissions();
    
    if (result.success) {
      const filtered = result.data.filter(submission => {
        const searchLower = searchTerm.toLowerCase();
        return (
          submission.client?.nom?.toLowerCase().includes(searchLower) ||
          submission.client?.adresse?.toLowerCase().includes(searchLower) ||
          submission.client?.telephone?.includes(searchTerm)
        );
      });

      return {
        success: true,
        data: filtered,
        count: filtered.length
      };
    }

    return { success: false, data: [], count: 0 };

  } catch (error) {
    console.error('❌ Erreur recherche:', error);
    return { success: false, data: [], count: 0 };
  }
};