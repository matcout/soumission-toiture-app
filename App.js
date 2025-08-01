import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  Linking
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { TextInput } from 'react-native';

// Import du nouveau système unifié
import FirebaseSync from './firebaseSync';

// Imports composants
import SoumissionForm from './components/SoumissionForm';
import AssignmentModal from './AssignmentModal';
import SubmissionViewer from './components/SubmissionViewer';



const safeText = (value, fallback = '') => {
  if (value === null || value === undefined) {
    console.warn('⚠️ safeText: valeur null/undefined:', value);
    return fallback;
  }
  if (typeof value === 'object') {
    console.warn('⚠️ safeText: objet détecté:', value);
    return JSON.stringify(value);
  }
  return String(value);
};

// 🔧 FONCTIONS DE MAINTENANCE
const correctParentIds = async () => {
  console.log('🔧 Correction des parentId...');
  
  try {
    // Mapping des anciens parentId vers les nouveaux
    const parentMapping = {
      'system_project2025': 'projet_2025',
      'system_project2024': 'projet_2024',
      'folder_allo_1751932501620': null, // Ces dossiers test seront orphelins
      'folder_maison_1751933590924': null,
      'folder_1752020017718': null,
      'folder_1752017001340': null
    };
    
    const foldersSnapshot = await getDocs(collection(db, 'folders'));
    let corrected = 0;
    let deleted = 0;
    
    for (const docSnapshot of foldersSnapshot.docs) {
      const data = docSnapshot.data();
      const updates = {};
      
      // Si le dossier a un parentId incorrect
      if (data.parentId && parentMapping.hasOwnProperty(data.parentId)) {
        const newParentId = parentMapping[data.parentId];
        
        if (newParentId === null) {
          // C'est un dossier test orphelin, on peut le supprimer
          console.log(`🗑️ Suppression dossier test orphelin: ${data.label}`);
          await deleteDoc(docSnapshot.ref);
          deleted++;
        } else {
          // Corriger le parentId
          console.log(`✏️ Correction: ${data.label} - parentId: ${data.parentId} → ${newParentId}`);
          updates.parentId = newParentId;
          
          await updateDoc(docSnapshot.ref, updates);
          corrected++;
        }
      }
    }
    
    console.log(`✅ Correction terminée: ${corrected} corrigés, ${deleted} supprimés`);
    return { success: true, corrected, deleted };
    
  } catch (error) {
    console.error('❌ Erreur correction:', error);
    return { success: false, error: error.message };
  }
};

// Fonction pour nettoyer les vieux dossiers test
const cleanupTestFolders = async () => {
  console.log('🧹 Nettoyage des dossiers test...');
  
  try {
    const testFolderNames = ['yo', 'Test', 'allo', 'soumissopm test 2024'];
    const foldersSnapshot = await getDocs(collection(db, 'folders'));
    let deleted = 0;
    
    for (const docSnapshot of foldersSnapshot.docs) {
      const data = docSnapshot.data();
      
      if (testFolderNames.includes(data.label) || 
          data.slug?.includes('test') || 
          data.slug?.includes('allo') ||
          data.slug?.includes('yo')) {
        console.log(`🗑️ Suppression dossier test: ${data.label}`);
        await deleteDoc(docSnapshot.ref);
        deleted++;
      }
    }
    
    console.log(`✅ ${deleted} dossiers test supprimés`);
    return { success: true, deleted };
    
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
    return { success: false, error: error.message };
  }
};
// FIN DES FONCTIONS DE MAINTENANCE 🔧

export default function App() {
  // États principaux
  const [submissions, setSubmissions] = useState([]);
  const [folders, setFolders] = useState({});
  const [foldersList, setFoldersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  
  // États navigation
  const [currentView, setCurrentView] = useState('dashboard');
  const [previousView, setPreviousView] = useState('dashboard');
const [selectedFolder, setSelectedFolder] = useState('assignments'); 
  
  // États UI
  const [expandedFolders, setExpandedFolders] = useState([]); // Slug au lieu d'ID
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showSubmissionViewer, setShowSubmissionViewer] = useState(false);
  const [viewerSubmission, setViewerSubmission] = useState(null);
const [selectedSubmission, setSelectedSubmission] = useState(null);
const [searchQuery, setSearchQuery] = useState('');
  // Initialisation et synchronisation avec FirebaseSync
  useEffect(() => {
    let unsubscribeSubmissions = null;
    let unsubscribeFolders = null;

    const initializeApp = async () => {
      console.log('🔥 Initialisation app mobile avec FirebaseSync...');
      
      try {
        // Initialiser les dossiers système
        const initResult = await FirebaseSync.initialize();
        setFirebaseConnected(initResult.success);
        
        if (initResult.success) {
          // S'abonner aux dossiers
unsubscribeFolders = FirebaseSync.subscribeFolders((result) => {
  if (result.success) {
    // 🔍 DEBUG POUR INVESTIGUER L'ORDRE
    console.log('📁 DOSSIERS REÇUS DE FIREBASE:');
    result.list.forEach(folder => {
      console.log(`   - ${folder.label}: order=${folder.order}, slug=${folder.slug}`);
    });
    
    setFolders(result.data);
    setFoldersList(result.list);
    console.log(`✅ ${result.list.length} dossiers synchronisés`);
  }
});
          // S'abonner aux soumissions
          unsubscribeSubmissions = FirebaseSync.subscribeSubmissions((result) => {
            if (result.success) {
              setSubmissions(result.data);
              console.log(`✅ ${result.count} soumissions synchronisées`);
            }
          });
        }
      } catch (error) {
        console.error('❌ Erreur initialisation:', error);
        setFirebaseConnected(false);
      } finally {
        setLoading(false);
      }
    };
    
    initializeApp();

    return () => {
      if (unsubscribeSubmissions) unsubscribeSubmissions();
      if (unsubscribeFolders) unsubscribeFolders();
    };
  }, []);

  // 🔧 DEBUG TEMPORAIRE - pour voir tous les dossiers
  useEffect(() => {
    if (foldersList.length > 0) {
      console.log('📁 TOUS LES DOSSIERS:');
      foldersList.forEach(folder => {
        console.log(`- ${folder.label} (parent: ${folder.parentId || 'aucun'}, slug: ${folder.slug})`);
      });
      
      // Compter les enfants de projet_2025
      const projet2025Children = foldersList.filter(f => f.parentId === 'projet_2025');
      console.log(`\n📊 Enfants de Projet 2025: ${projet2025Children.length}`);
      projet2025Children.forEach(child => {
        console.log(`  - ${child.label} (${child.slug})`);
      });
    }
  }, [foldersList]);


  
  useEffect(() => {
  if (folders && Object.keys(folders).length > 0 && submissions.length > 0) {
    console.log('\n🔍 === DEBUG RAPIDE ===');
    
    // 1. Les dossiers système existent ?
    console.log('Dossier assignments existe ?', !!folders['assignments']);
    console.log('Dossier pending existe ?', !!folders['pending']);
    
    // 2. Combien de soumissions par folderId ?
    const assignmentCount = submissions.filter(s => s.folderId === 'assignments').length;
    const pendingCount = submissions.filter(s => s.folderId === 'pending').length;
    
    console.log(`Soumissions avec folderId "assignments": ${assignmentCount}`);
    console.log(`Soumissions avec folderId "pending": ${pendingCount}`);
    
    // 3. Exemple d'une soumission
    if (submissions[0]) {
      console.log('\nExemple soumission:', {
        adresse: submissions[0].client?.adresse,
        folderId: submissions[0].folderId,
        folderIdType: typeof submissions[0].folderId
      });
    }
    
    console.log('=== FIN DEBUG ===\n');
  }
}, [folders, submissions]);

  // Créer un nouvel assignment
 const handleCreateAssignment = async (assignmentData, isEditMode = false) => {
  try {
    if (isEditMode) {
      // Mode édition : assignmentData contient déjà toutes les données
      const result = await FirebaseSync.updateSubmission(assignmentData.id, {
        client: assignmentData.client,
        notes: assignmentData.notes,
        displayName: assignmentData.displayName,
        updatedAt: assignmentData.updatedAt
      });
      
      if (result.success) {
        Alert.alert('Succès', 'Assignment modifié avec succès');
        setShowAssignmentModal(false);
        setSelectedSubmission(null);
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de modifier l\'assignment');
      }
    } else {
      // Mode création : créer un nouvel assignment
      const result = await FirebaseSync.createAssignment({
        client: assignmentData.client,
        notes: assignmentData.notes,
        displayName: assignmentData.client.adresse
      }, 'mobile');
      
      if (result.success) {
        Alert.alert('Succès', 'Assignment créé avec succès');
        setShowAssignmentModal(false);
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de créer l\'assignment');
      }
    }
  } catch (error) {
    Alert.alert('Erreur', 'Une erreur est survenue : ' + error.message);
  }
};

  const handleDeleteSubmission = (submissionId, submissionName) => {
    Alert.alert(
      'Confirmer la suppression',
      `Supprimer "${submissionName}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await FirebaseSync.deleteSubmission(submissionId);
              if (result.success) {
                Alert.alert('Succès', 'Soumission supprimée');
              } else {
                Alert.alert('Erreur', 'Impossible de supprimer la soumission');
              }
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          }
        }
      ]
    );
  };

  // Naviguer vers le formulaire
  const handleNavigateToForm = (submission = null) => {
    setSelectedSubmission(submission);
    setCurrentView('form');
  };

  const handleOpenViewer = (submission) => {
    setViewerSubmission(submission);
    setShowSubmissionViewer(true);
  };

  // Ouvrir Google Maps
  const openAddressInMaps = (address) => {
    if (!address || !address.trim()) {
      Alert.alert('Navigation', 'Aucune adresse disponible pour la navigation');
      return;
    }
    
    const encodedAddress = encodeURIComponent(address.trim());
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    
    Linking.openURL(googleMapsUrl)
      .then(() => {
        console.log('🗺️ Google Maps ouvert');
      })
      .catch((error) => {
        console.error('❌ Erreur ouverture Google Maps:', error);
        Alert.alert('Erreur', 'Impossible d\'ouvrir Google Maps');
      });
  };

  // Retour au dashboard
  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedSubmission(null);
  };

  // Toggle dossier étendu
  const toggleFolder = (folderSlug) => {
    setExpandedFolders(prev =>
      prev.includes(folderSlug)
        ? prev.filter(slug => slug !== folderSlug)
        : [...prev, folderSlug]
    );
  };

// 1. MODIFIER votre fonction getFilteredSubmissions existante
// Remplacez toute votre fonction getFilteredSubmissions par celle-ci :

const getFilteredSubmissions = (folderSlug = null) => {
  const targetSlug = folderSlug || selectedFolder;
  
  // 🔍 DEBUG TEMPORAIRE
  console.log('🔍 MOBILE DEBUG getFilteredSubmissions:');
  console.log('   targetSlug:', targetSlug);
  console.log('   folders keys:', Object.keys(folders));
  console.log('   foldersList:', foldersList.map(f => `${f.label} (${f.id})`));
  console.log('   submissions folderId:', submissions.map(s => s.folderId));

  if (!targetSlug) {
    console.log('❌ Aucun dossier sélectionné');
    return [];
  }
  
  console.log(`📱 Mobile - Filtrage pour: "${targetSlug}"`);
  
  // 🔧 CAS SPÉCIAUX : Dossiers custom Soumissions
  if (targetSlug === 'projet_2025_soumissions') {
    let filtered = submissions.filter(s => s.folderId === 'projet_2025_soumissions');
    console.log(`📱 Mobile - Soumissions custom: ${filtered.length} soumissions`);
    
    // NOUVEAU : Appliquer le filtre de recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(submission => {
        const address = submission.client?.adresse?.toLowerCase() || '';
        return address.includes(query);
      });
      console.log(`🔍 Recherche "${query}": ${filtered.length} résultats`);
    }
    
    return filtered;
  }
  
  // Chercher le dossier par slug dans folders OU foldersList
  let folder = folders[targetSlug];
  
  // Si pas trouvé par slug, chercher dans la liste
  if (!folder) {
    folder = foldersList.find(f => 
      f.slug === targetSlug || 
      f.id === targetSlug ||
      f.label?.toLowerCase() === targetSlug.toLowerCase()
    );
  }
  
  if (!folder) {
    console.log('❌ Dossier non trouvé:', targetSlug);
    return [];
  }
  
  // Si le dossier a une fonction de filtre
  if (folder.filterFn) {
    let filtered = folder.filterFn(submissions);
    console.log(`📱 Mobile - Filtre système "${folder.label}": ${filtered.length} soumissions`);
    
    // NOUVEAU : Appliquer le filtre de recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(submission => {
        const address = submission.client?.adresse?.toLowerCase() || '';
        return address.includes(query);
      });
      console.log(`🔍 Recherche "${query}": ${filtered.length} résultats`);
    }
    
    return filtered;
  }
  
  // Fallback pour autres dossiers personnalisés
  let filtered = submissions.filter(s => s.folderId === targetSlug);
  console.log(`📱 Mobile - Filtre folderId "${targetSlug}": ${filtered.length} soumissions`);
  
  // NOUVEAU : Appliquer le filtre de recherche
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(submission => {
      const address = submission.client?.adresse?.toLowerCase() || '';
      return address.includes(query);
    });
    console.log(`🔍 Recherche "${query}": ${filtered.length} résultats`);
  }
  
  return filtered;
};

  // 🔧 FONCTION CORRIGÉE - Organiser les dossiers en hiérarchie
  const getOrganizedFolders = () => {
  // 🔍 DEBUG - Voir l'ordre AVANT tri
  console.log('🔍 AVANT TRI - Ordre des dossiers:');
  foldersList.forEach(folder => {
    console.log(`   ${folder.label}: order=${folder.order} (type: ${typeof folder.order})`);
  });

  const rootFolders = [];
  const folderMap = {};
  
  // D'abord, créer une map de tous les dossiers
  foldersList.forEach(folder => {
    const folderId = folder.slug || folder.id;
    folderMap[folderId] = { 
      ...folder, 
      children: [] 
    };
  });
  
  // Ensuite, organiser en hiérarchie
  foldersList.forEach(folder => {
    const folderId = folder.slug || folder.id;
    
    if (folder.parentId) {
      // Chercher le parent par slug OU id
      const parent = folderMap[folder.parentId];
      
      if (parent) {
        parent.children.push(folderMap[folderId]);
      } else {
        // Si parent non trouvé, l'ajouter comme root
        console.warn(`⚠️ Parent non trouvé pour ${folder.label} (parent: ${folder.parentId})`);
        rootFolders.push(folderMap[folderId]);
      }
    } else {
      // Pas de parent = dossier racine
      rootFolders.push(folderMap[folderId]);
    }
  });
  console.log('🔍 ROOT FOLDERS AVANT TRI:');
rootFolders.forEach(folder => {
  console.log(`   - ${folder.label}: order=${folder.order}, slug=${folder.slug}`);
});
  // Trier par ordre
  rootFolders.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  
  console.log('🔍 TEST FONCTION TRI:');
const testArray = [
  { label: 'Test A', order: 1 },
  { label: 'Test B', order: 0 },
  { label: 'Test C', order: 2 }
];
testArray.sort((a, b) => (a.order || 999) - (b.order || 999));
console.log('Résultat test:', testArray.map(t => `${t.label}:${t.order}`));

// 🔍 DEBUG - Voir l'ordre APRÈS tri
console.log('🔍 APRÈS TRI - Ordre final:');
rootFolders.forEach((folder, index) => {
  console.log(`   ${index + 1}. ${folder.label}: order=${folder.order} (type: ${typeof folder.order})`);
});
  // 🔍 DEBUG - Voir l'ordre APRÈS tri
  console.log('🔍 APRÈS TRI - Ordre final:');
  rootFolders.forEach((folder, index) => {
    console.log(`   ${index + 1}. ${folder.label}: order=${folder.order}`);
  });
  
  // Trier aussi les sous-dossiers
  Object.values(folderMap).forEach(folder => {
    if (folder.children && folder.children.length > 0) {
      folder.children.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }
  });
  
  return rootFolders;
};

  // 🔧 FONCTION CORRIGÉE - Rendu d'un dossier
 const renderFolder = (folder, level = 0) => {
  // ✅ VÉRIFICATIONS DE SÉCURITÉ
  if (!folder || !folder.slug || folder.slug === 'undefined') {
    console.warn('⚠️ renderFolder: Dossier ignoré:', folder);
    return null;
  }

  console.log('🔍 renderFolder DEBUG:', {
    label: folder?.label,
    labelType: typeof folder?.label,
    slug: folder?.slug,
    hasLabel: !!folder?.label
  });

  const isSelected = selectedFolder === folder.slug;
  const hasChildren = folder.children && folder.children.length > 0;
  const isExpanded = expandedFolders.includes(folder.slug);
  
  // Calculer le count correctement
  let count = 0;
  if (folder.filterFn) {
    try {
      count = folder.filterFn(submissions).length;
    } catch (error) {
      console.warn('Erreur calcul count:', error);
      count = 0;
    }
  }
  
  // Si c'est un dossier parent, compter aussi les soumissions des enfants
  if (hasChildren) {
    folder.children.forEach(child => {
      if (child.filterFn) {
        try {
          count += child.filterFn(submissions).length;
        } catch (error) {
          console.warn('Erreur calcul count enfant:', error);
        }
      }
    });
  }
  
  return (
    <View key={safeText(folder.slug, `folder-${Math.random()}`)}>
      <View style={[
        styles.folderItem, 
        isSelected && styles.folderItemSelected
      ]}>
        <TouchableOpacity
          style={[styles.folderContent, { paddingLeft: 16 + level * 20 }]}
          onPress={() => {
            console.log('📁 Clic sur dossier:', safeText(folder.label), '| Slug:', safeText(folder.slug));
            
            // 🔧 LOGIQUE UNIVERSELLE : Tous les dossiers "Projet XXXX"
            const isProjectFolder = folder.label?.match(/^Projet \d{4}$/i);
            
            if (isProjectFolder) {
              console.log(`📁 Clic sur ${safeText(folder.label)} - EXPANSION SEULEMENT`);
             
              // ✅ SEULEMENT TOGGLE L'EXPANSION
              if (expandedFolders.includes(folder.slug)) {
                setExpandedFolders(prev => prev.filter(slug => slug !== folder.slug));
                console.log(`📁 ${safeText(folder.label)} fermé`);
              } else {
                setExpandedFolders(prev => [...prev, folder.slug]);
                console.log(`📁 ${safeText(folder.label)} ouvert`);
              }
             
              console.log('📁 selectedFolder reste:', selectedFolder);
              return;
             
            } else {
              // ✅ COMPORTEMENT NORMAL pour tous les autres dossiers
              setSelectedFolder(folder.id);
              console.log('📱 selectedFolder défini à:', folder.id);
              setCurrentView('folderView');
             
              // Si c'est un dossier parent avec des enfants, toggle l'expansion
              if (hasChildren && level === 0) {
                console.log('📂 Toggle expansion pour:', safeText(folder.label));
                toggleFolder(folder.slug);
                return;
              }
             
              // Pour les dossiers système principaux, ouvrir la vue séparée
              if (folder.slug === 'assignments' ||
                  folder.slug === 'pending' ||
                  folder.slug === 'completed') {
                console.log('🎯 Navigation vers vue séparée:', safeText(folder.label));
                setSelectedFolder(folder.slug);
                setCurrentView('folderView');
                return;
              }
             
              // Pour tous les autres dossiers (y compris sous-dossiers), sélectionner
              if (selectedFolder === folder.slug) {
                setSelectedFolder(null);
              } else {
                setSelectedFolder(folder.slug);
              }
            }
          }}
        >
          {hasChildren && level === 0 && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                toggleFolder(folder.slug);
              }}
              style={styles.chevronButton}
            >
              <FontAwesome5
                name={isExpanded ? 'chevron-down' : 'chevron-right'}
                size={12}
                color="#6c7680"
              />
            </TouchableOpacity>
          )}
          
          <FontAwesome5
            name={safeText(folder.icon, 'folder')}
            size={16}
            color={safeText(folder.color, '#6b7280')}
            style={styles.folderIcon}
          />
          
          <Text style={[styles.folderLabel, isSelected && styles.folderLabelSelected]}>
            {safeText(folder.label, 'Dossier sans nom')}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.folderActions}>
          {count > 0 && !folder.label?.match(/^Projet \d{4}$/i) && (
            <View style={styles.folderBadge}>
              <Text style={styles.folderBadgeText}>{safeText(count, '0')}</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Sous-dossiers */}
      {hasChildren && isExpanded && (
        <View>
          {folder.children.map((child) => {
            // ✅ VÉRIFICATION DES ENFANTS AUSSI
            if (!child || !child.slug || child.slug === 'undefined') {
              return null;
            }
            return renderFolder(child, level + 1);
          })}
        </View>
      )}
    </View>
  );
};

  // Dashboard principal
const renderDashboard = () => {
  const currentFolder = folders[selectedFolder];
  const filteredSubmissions = getFilteredSubmissions();

  console.log('🔍 DEBUG MOBILE renderDashboard:');
  console.log('   📁 selectedFolder:', selectedFolder);
  console.log('   📄 submissions total:', submissions.length);
  console.log('   🎯 filteredSubmissions:', filteredSubmissions.length);

  const folderIds = [...new Set(submissions.map(s => s.folderId).filter(Boolean))];
  console.log('   📋 FolderIds disponibles:', folderIds);
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar style="dark" backgroundColor="#f8fafc"/>
      
      {/* Header principal */}
      <View style={styles.mainHeader}>
        <View style={styles.appInfo}>
          <View style={styles.appIcon}>
            <FontAwesome5 name="home" size={24} color="white"/>
          </View>
          <View>
            <Text style={styles.appTitle}>Soumission Toiture</Text>
          </View>
        </View>
      </View>
      
      {/* NOUVELLE BARRE DE RECHERCHE */}
      <View style={styles.searchContainer}>
        <FontAwesome5 
          name="search" 
          size={16} 
          color="#9ca3af" 
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par adresse..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <FontAwesome5 name="times-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* OPTIONNEL: Afficher le nombre de résultats de recherche */}
      {searchQuery.trim() && (
        <View style={styles.searchResults}>
          <Text style={styles.searchResultsText}>
            {filteredSubmissions.length} résultat{filteredSubmissions.length !== 1 ? 's' : ''} trouvé{filteredSubmissions.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Bouton nouvelle soumission */}
      <View style={styles.newButtonContainer}>
        <TouchableOpacity
          style={styles.newButton}
          onPress={async () => {
            setPreviousView('dashboard');
            try {
              const draftString = await AsyncStorage.getItem('SOUMISSION_DRAFT');
              if (draftString) {
                const draft = JSON.parse(draftString);
                const hasData = draft.formData?.nom || draft.formData?.adresse || 
                               draft.formData?.telephone || draft.formData?.courriel || 
                               draft.formData?.notes || draft.photos?.length > 0;
                
                if (hasData) {
                  Alert.alert(
                    'Brouillon trouvé',
                    'Un brouillon de soumission a été trouvé. Voulez-vous le restaurer ?',
                    [
                      {
                        text: 'Non, nouveau',
                        style: 'cancel',
                        onPress: () => {
                          global.skipDraftLoad = true;
                          handleNavigateToForm();
                        }
                      },
                      {
                        text: 'Oui, restaurer',
                        style: 'default',
                        onPress: () => {
                          global.skipDraftLoad = false;
                          handleNavigateToForm();
                        }
                      }
                    ]
                  );
                  return;
                }
              }
            } catch (error) {
              console.error('Erreur vérification brouillon:', error);
            }
            
            handleNavigateToForm();
          }}
        >
          <FontAwesome5 name="plus" size={20} color="white" />
          <Text style={styles.newButtonText}>Nouvelle soumission</Text>
        </TouchableOpacity>
      </View>

      {/* Vue unique avec tous les dossiers et contenus */}
      <View style={styles.mainContent}>
        <View style={styles.foldersSectionHeader}>
          <Text style={styles.foldersTitle}>DOSSIERS</Text>
        </View>
        
        <ScrollView style={styles.mainScrollView} showsVerticalScrollIndicator={false}>
          {/* Rendu de tous les dossiers avec PROTECTION contre slug undefined */}
          {getOrganizedFolders().map((folder) => {
            // ✅ PROTECTION contre les slugs undefined
            if (!folder || !folder.slug || folder.slug === 'undefined') {
              console.warn('⚠️ Dossier avec slug invalide ignoré:', folder);
              return null;
            }
            
            return (
              <View key={folder.slug}>
                {renderFolder(folder)}
                
               {/* Afficher les soumissions si le dossier est sélectionné OU si on a une recherche active */}
{(selectedFolder === folder.slug || (searchQuery.trim() && getFilteredSubmissions(folder.slug).length > 0)) && 
 folder.slug !== 'assignments' && 
 folder.slug !== 'pending' && 
 folder.slug !== 'completed' && (
  <View style={styles.submissionsContainer}>
    {(() => {
      // Obtenir les soumissions pour CE dossier spécifique
      const folderSubmissions = searchQuery.trim() 
        ? getFilteredSubmissions(folder.slug) 
        : (selectedFolder === folder.slug ? filteredSubmissions : []);
      
      return folderSubmissions.length === 0 ? (
        <Text style={styles.noSubmissionsText}>
          {searchQuery.trim() ? 'Aucun résultat dans ce dossier' : 'Aucune soumission dans ce dossier'}
        </Text>
      ) : (
        folderSubmissions.map(submission => (
          <TouchableOpacity
            key={submission.id}
            style={styles.submissionItem}
            onPress={() => {
              console.log('🎯 Clic sur soumission:', submission.id, submission.client?.adresse);
              handleOpenViewer(submission);
            }}
            onLongPress={() => {
              Alert.alert(
                'Options',
                safeText(submission.client?.adresse || submission.displayName, 'Cette soumission'),
                [
                  { text: 'Annuler', style: 'cancel' },
                  { 
                    text: 'Modifier', 
                    onPress: () => {
                      setPreviousView('dashboard');
                      handleNavigateToForm(submission);
                    }
                  },
                  {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => handleDeleteSubmission(
                      submission.id, 
                      safeText(submission.client?.adresse || submission.displayName, 'cette soumission')
                    )
                  }
                ]
              );
            }}
          >
            <View style={styles.submissionContent}>
              <Text style={styles.submissionTitle}>
                {safeText(submission.client?.adresse || submission.displayName || submission.client?.nom, 'Sans nom')}
              </Text>
              {submission.client?.nom && submission.client?.adresse && (
                <Text style={styles.submissionSubtitle}>
                  {safeText(`Client: ${submission.client.nom}`, '')}
                </Text>
              )}
              {submission.notes && (
                <Text style={styles.submissionNotes} numberOfLines={1}>
                  {safeText(submission.notes, '')}
                </Text>
              )}
              <Text style={styles.submissionDate}>
                {new Date(submission.createdAt || submission.timestamp).toLocaleDateString('fr-CA')}
              </Text>
            </View>
            
            <View style={styles.submissionRight}>
              {submission.photos && submission.photos.length > 0 && (
                <View style={styles.photoBadge}>
                  <FontAwesome5 name="camera" size={10} color="#666" />
                  <Text style={styles.photoCount}>{safeText(submission.photos.length, '0')}</Text>
                </View>
              )}
              <FontAwesome5 name="chevron-right" size={14} color="#6c7680" />
            </View>
          </TouchableOpacity>
        ))
      );
    })()}
  </View>
)}
              </View>
            );
          })}
        </ScrollView>
      </View>
      
      {/* Footer avec statut de connexion */}
      <View style={styles.footer}>
        <View style={styles.connectionStatus}>
          <View style={[
            styles.statusDot,
            { backgroundColor: firebaseConnected ? '#4ade80' : '#ef4444' }
          ]} />
          <Text style={styles.statusText}>
            {safeText(firebaseConnected ? 'Synchronisé' : 'Hors ligne', 'Statut inconnu')}
          </Text>
        </View>
      </View>
      
      {/* Modal SubmissionViewer */}
      {showSubmissionViewer && viewerSubmission && (
        <Modal
          visible={showSubmissionViewer}
          animationType="slide"
          onRequestClose={() => setShowSubmissionViewer(false)}
        >
          <SubmissionViewer
            submission={viewerSubmission}
            onBack={() => {
              setShowSubmissionViewer(false);
              setViewerSubmission(null);
            }}
          />
        </Modal>
      )}
      
      {/* Modals */}
      <AssignmentModal
        visible={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        onSubmit={handleCreateAssignment}
      />
    </SafeAreaView>
  );
};

  // Vue Folder séparée
// Vue Folder séparée - CORRIGÉE
// Modifiez votre renderFolderView avec ces changements

const renderFolderView = () => {
  const currentFolder = folders[selectedFolder];
  const filteredSubmissions = getFilteredSubmissions();
  const canCreateNew = selectedFolder === 'assignments';
  const isAssignmentsView = selectedFolder === 'assignments'; // Pour identifier la vue assignments
 const isPendingView = selectedFolder === 'pending';  // ← NOUVELLE LIGNE
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar style="dark" backgroundColor="#f8fafc" />
      {/* Header avec bouton retour */}
      <View style={styles.assignmentsHeader}>
        <TouchableOpacity 
          onPress={() => {
            setSelectedFolder(null);
            setCurrentView('dashboard');
          }}
          style={styles.backButton}
        >
          <FontAwesome5 name="arrow-left" size={20} color="#0ea5e9" />
        </TouchableOpacity>
        
        <Text style={styles.assignmentsTitle}>
          {currentFolder?.label || 'Dossier'}
        </Text>
        
        <View style={{ width: 40 }} />
      </View>
      
      {/* Bouton nouvel assignment */}
      {canCreateNew && (
        <View style={styles.newAssignmentContainer}>
          <TouchableOpacity
            style={styles.newAssignmentButtonFull}
            onPress={() => setShowAssignmentModal(true)}
          >
            <FontAwesome5 name="plus" size={18} color="white" />
            <Text style={styles.newAssignmentTextFull}>Nouvel assignment</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Liste des soumissions */}
      <ScrollView style={styles.assignmentsList}>
        {loading ? (
          <ActivityIndicator size="large" color="#5B9BD5" style={{ marginTop: 50 }} />
        ) : filteredSubmissions.length === 0 ? (
          <View style={styles.emptyAssignments}>
            <FontAwesome5 
              name={currentFolder?.icon || 'folder-open'} 
              size={50} 
              color="#6c7680" 
            />
            <Text style={styles.emptyAssignmentsText}>
              Aucune soumission dans {currentFolder?.label || 'ce dossier'}
            </Text>
          </View>
        ) : (
        filteredSubmissions.map(submission => {
  const isPending = submission.status === 'captured' || submission.status === 'pending' || !submission.status;
  const isCompleted = submission.status === 'completed';
  const isAssignmentsView = selectedFolder === 'assignments';
 
  
  // Formater la date de création
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const options = { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('fr-CA', options);
  };
  
  // Fonction pour appeler le numéro
const handlePhoneActions = (phoneNumber) => {
  if (!phoneNumber) {
    Alert.alert('Téléphone', 'Aucun numéro de téléphone disponible');
    return;
  }
  
  // Nettoyer le numéro (enlever les tirets, espaces, etc.)
  const cleanedNumber = phoneNumber.replace(/\D/g, '');
  
  Alert.alert(
    'Contact',
    phoneNumber,
    [
      {
        text: 'Appeler',
        onPress: () => {
          const phoneUrl = `tel:${cleanedNumber}`;
          Linking.openURL(phoneUrl).catch(err => {
            console.error('Erreur appel:', err);
            Alert.alert('Erreur', 'Impossible d\'appeler ce numéro');
          });
        }
      },
      {
        text: 'Message texte',
        onPress: () => {
          const smsUrl = `sms:${cleanedNumber}`;
          Linking.openURL(smsUrl).catch(err => {
            console.error('Erreur SMS:', err);
            Alert.alert('Erreur', 'Impossible d\'envoyer un SMS à ce numéro');
          });
        }
      },
      {
        text: 'Annuler',
        style: 'cancel'
      }
    ]
  );
};
  
  return (
    <TouchableOpacity
      key={submission.id}
      style={styles.assignmentCard}
      onPress={() => {
        if (isAssignmentsView) {
          setSelectedSubmission(submission);
          setShowAssignmentModal(true);
        } else {
          handleOpenViewer(submission);
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.cardTouchable}>
        {/* En-tête avec adresse et boutons */}
        <View style={styles.cardHeader}>
          <View style={styles.addressRow}>
            <FontAwesome5 name="home" size={14} color="#3498db" />
            <Text style={styles.cardAddress} numberOfLines={1}>
              {submission.client?.adresse || submission.displayName || 'Adresse inconnue'}
            </Text>
          </View>
          
          {/* Boutons d'action à droite */}
          <View style={styles.rightActions}>
            <TouchableOpacity 
onPress={(e) => {
  e.stopPropagation();
  openAddressInMaps(submission.client?.adresse || submission.displayName);  // ✅ CORRECT
}}
              style={[
                styles.mapsButton,
                { opacity: (submission.client?.adresse || submission.displayName) ? 1 : 0.5 }
              ]}
              disabled={!submission.client?.adresse && !submission.displayName}
            >
              <FontAwesome5 name="map-marker-alt" size={14} color="white" />
            </TouchableOpacity>
            
            {/* Afficher le badge de statut SEULEMENT si on n'est PAS dans assignments */}
            {!isAssignmentsView && !isPendingView && (
              <View style={[
                styles.statusBadgeNew, 
                isPending && styles.pendingBadge,
                isCompleted && styles.completedBadge
              ]}>
                <Text style={[
                  styles.statusTextNew,
                  isCompleted && { color: 'white' }
                ]}>
                  {submission.status === 'assignment' ? 'Assignment' : 
                   submission.status === 'completed' ? 'Complétée' : 'À compléter'}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* SECTION MODIFIÉE : Affichage différent selon la vue */}
        {(isAssignmentsView || isPendingView) ? (
          <>
            {/* Nom du client */}
            {submission.client?.nom && (
              <View style={styles.clientInfoRow}>
                
                <Text style={styles.cardClient}>{submission.client.nom}</Text>
              </View>
            )}
            
            {/* Téléphone cliquable */}
            {submission.client?.telephone && (
              <TouchableOpacity 
                style={styles.phoneRow}
              onPress={(e) => {
  e.stopPropagation();
  handlePhoneActions(submission.client.telephone);  // ✅ CORRECT
}}
              >
                <FontAwesome5 name="phone" size={12} color="#0ea5e9" />
                <Text style={styles.phoneText}>{submission.client.telephone}</Text>
              </TouchableOpacity>
            )}
            
            {/* Date de création */}
            <View style={styles.dateRow}>
              <FontAwesome5 name="calendar" size={12} color="#666" />
              <Text style={styles.dateText}>
                Créé le {formatDate(submission.createdAt || submission.timestamp)}
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Vue normale (non-assignments) : garder l'affichage actuel */}
            {submission.client?.nom && (
              <Text style={styles.cardClient}>Client: {submission.client.nom}</Text>
            )}
            
            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <FontAwesome5 name="ruler-combined" size={12} color="#666" />
                <Text style={styles.detailText}>
                  Superficie: {(() => {
                    let superficie = 0;
                    if (submission.toiture?.superficie) {
                      Object.values(submission.toiture.superficie).forEach(val => {
                        superficie += parseFloat(val) || 0;
                      });
                    }
                    if (submission.clientInfo?.roofInfo?.totalSuperficie) {
                      superficie = submission.clientInfo.roofInfo.totalSuperficie;
                    }
                    return superficie.toFixed(0);
                  })()} pi²
                </Text>
              </View>
              <View style={styles.detailItem}>
                <FontAwesome5 name="camera" size={12} color="#666" />
                <Text style={styles.detailText}>Photos: {submission.photos?.length || 0}</Text>
              </View>
            </View>
          </>
        )}
        
        {/* Notes si présentes */}
        {submission.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesTitle}>Notes:</Text>
            <Text style={styles.notesText} numberOfLines={2}>{submission.notes}</Text>
          </View>
        )}
      </View>
      
      {/* Boutons Voir/Mesurer et Calculer */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.viewButton]}
          onPress={(e) => {
            e.stopPropagation();
            console.log('🎯 Bouton Voir/Mesurer cliqué - Dossier:', selectedFolder);
            
            if (selectedFolder === 'assignments') {
              setPreviousView('folderView');
              handleNavigateToForm(submission);
            } else {
              console.log('✅ Ouverture du SubmissionViewer');
              handleOpenViewer(submission);
            }
          }}
        >
          <FontAwesome5 name="eye" size={14} color="#374151" />
          <Text style={styles.buttonText}>
            {selectedFolder === 'assignments' ? 'Mesurer' : 'Voir'}
          </Text>
        </TouchableOpacity>
        
        {/* Afficher le bouton Calculer SEULEMENT si on n'est PAS dans assignments */}
        {!isAssignmentsView && isPending && selectedFolder !== 'completed' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.calculateButton]}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert(
                'Fonction bureau', 
                'Le calculateur est accessible sur ordinateur seulement',
                [{ text: 'OK', style: 'default' }]
              );
            }}
          >
            <FontAwesome5 name="calculator" size={14} color="white" />
            <Text style={[styles.buttonText, styles.calculateButtonText]}>Calculer</Text>
          </TouchableOpacity>
        )}
      </View>
      
    </TouchableOpacity>
  );
})
        )}
      </ScrollView>
      
      {/* Modal Submission Viewer */}
      {showSubmissionViewer && viewerSubmission && (
        <Modal
          visible={showSubmissionViewer}
          animationType="slide"
          onRequestClose={() => setShowSubmissionViewer(false)}
        >
          <SubmissionViewer
            submission={viewerSubmission}
            onBack={() => {
              setShowSubmissionViewer(false);
              setViewerSubmission(null);
            }}
          />
        </Modal>
      )}
      
      {/* Modal Assignment - Modifiée pour gérer l'édition */}
      {canCreateNew && (
        <AssignmentModal
          visible={showAssignmentModal}
          onClose={() => {
            setShowAssignmentModal(false);
            setSelectedSubmission(null);
          }}
          onSubmit={handleCreateAssignment}
          initialData={selectedSubmission} // Passer les données existantes
          isEditMode={!!selectedSubmission} // Indiquer si on est en mode édition
        />
      )}
      
    </SafeAreaView>
  );
};

  // Vue formulaire
  if (currentView === 'form') {
    return (
      <SoumissionForm
        prefilledData={selectedSubmission}
        onReturn={() => {
          setCurrentView(previousView || 'dashboard');
          setSelectedSubmission(null);
        }}
        onComplete={async (submissionId) => {
          // Mettre à jour le status si c'était un assignment
          if (selectedSubmission?.status === 'assignment') {
            await FirebaseSync.updateSubmission(submissionId, {
              status: 'captured',
              folderSlug: 'pending'
            });
          }
          
          setCurrentView(previousView || 'dashboard');
          setSelectedSubmission(null);
        }}
      />
    );
  }

  // Vue folder
  if (currentView === 'folderView') {
    return renderFolderView();
  }

  // Vue dashboard par défaut
  return renderDashboard();
}


// 🎨 VOS STYLES TRANSFORMÉS EN THÈME CLAIR
// Remplacez votre const styles actuel par celui-ci :

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',        // ✅ CHANGÉ: était '#1e2936'
  },
  mainHeader: {
    backgroundColor: '#f8fafc',        
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 15 : 25,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#0ea5e9',        // ✅ CHANGÉ: était '#5B9BD5' (bleu plus moderne)
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  appTitle: {
    color: '#1e293b',                  // ✅ CHANGÉ: était 'white'
    fontSize: 18,
    fontWeight: '600',
  },
  appVersion: {
    color: '#64748b',                  // ✅ CHANGÉ: était '#8e9297'
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  newButtonContainer: {
    padding: 16,
    backgroundColor: '#f8fafc',        // ✅ CHANGÉ: était '#2c3e50'
  },
  newButton: {
    backgroundColor: '#0ea5e9',        // ✅ CHANGÉ: était '#5B9BD5'
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,                  // ✅ CHANGÉ: était 10 (plus arrondi)
    // ✅ AJOUTÉ: Ombre moderne
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  newButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',        // ✅ CHANGÉ: était '#2c3e50'
  },
  mainScrollView: {
    flex: 1,
  },
  foldersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  foldersTitle: {
    color: '#64748b',                  // ✅ CHANGÉ: était '#8e9297'
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  addFolderButton: {
    padding: 4,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    // ✅ AJOUTÉ: Bordure subtile entre les items
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  folderItemSelected: {
    backgroundColor: '#e0f2fe',        // ✅ CHANGÉ: était 'rgba(91, 155, 213, 0.15)'
    borderRadius: 8,                   // ✅ AJOUTÉ: Coins arrondis pour selection
    marginHorizontal: 8,
    paddingHorizontal: 12,
  },
  folderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chevronButton: {
    marginRight: 8,
    width: 20,
  },
  folderIcon: {
    marginRight: 12,
  },
  folderLabel: {
    color: '#1e293b',                  // ✅ CHANGÉ: était '#ffffff'
    fontSize: 16,
    flex: 1,
  },
  folderLabelSelected: {
    fontWeight: '600',                 // ✅ CHANGÉ: était '500' (plus visible)
    color: '#0ea5e9',                  // ✅ AJOUTÉ: Couleur accent quand sélectionné
  },
  folderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderBadge: {
    backgroundColor: '#e2e8f0',        // ✅ CHANGÉ: était '#5a6772'
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginRight: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  folderBadgeText: {
    color: '#475569',                  // ✅ CHANGÉ: était '#ffffff'
    fontSize: 13,
    fontWeight: '600',
  },
  moreButton: {
    padding: 6,
  },
  submissionsContainer: {
    backgroundColor: '#ffffff',        // ✅ CHANGÉ: était '#34495e'
    marginTop: 5,
    marginBottom: 10,
    marginHorizontal: 8,               // ✅ AJOUTÉ: Marges latérales
    borderRadius: 12,                  // ✅ AJOUTÉ: Coins arrondis
    // ✅ AJOUTÉ: Ombre subtile
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  folderHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#0ea5e9',        // ✅ CHANGÉ: était '#2c3e50'
    borderTopLeftRadius: 12,           // ✅ AJOUTÉ: Coins arrondis en haut
    borderTopRightRadius: 12,
  },
  folderHeaderTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',                 // ✅ CHANGÉ: était '500'
  },
  newAssignmentButton: {
    backgroundColor: '#ffffff',        // ✅ CHANGÉ: était '#5B9BD5'
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    // ✅ AJOUTÉ: Bordure colorée
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  newAssignmentText: {
    color: '#0ea5e9',                  // ✅ CHANGÉ: était 'white'
    fontSize: 13,
    fontWeight: '600',                 // ✅ CHANGÉ: était '500'
    marginLeft: 5,
  },
  noSubmissionsText: {
    color: '#64748b',                  // ✅ CHANGÉ: était '#8e9297'
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
  submissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,            // ✅ CHANGÉ: était 1
    borderBottomColor: '#f1f5f9',      // ✅ CHANGÉ: était '#2c3e50'
  },
  submissionContent: {
    flex: 1,
    marginRight: 10,
  },
  submissionTitle: {
    color: '#1e293b',                  // ✅ CHANGÉ: était '#ffffff'
    fontSize: 15,
    fontWeight: '600',                 // ✅ CHANGÉ: était '500'
    marginBottom: 2,
  },
  submissionSubtitle: {
    color: '#64748b',                  // ✅ CHANGÉ: était '#8e9297'
    fontSize: 13,
    marginBottom: 2,
  },
  submissionNotes: {
    color: '#94a3b8',                  // ✅ CHANGÉ: était '#6c7680'
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 3,
  },
  submissionDate: {
    color: '#94a3b8',                  // ✅ CHANGÉ: était '#6c7680'
    fontSize: 11,
    marginTop: 2,
  },
  submissionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',        // ✅ CHANGÉ: était 'rgba(255, 255, 255, 0.1)'
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  photoCount: {
    color: '#0ea5e9',                  // ✅ CHANGÉ: était '#fff'
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8,
  },
  statusAssignment: {
    backgroundColor: '#dbeafe',        // ✅ CHANGÉ: était 'rgba(91, 155, 213, 0.3)'
  },
  statusPending: {
    backgroundColor: '#fef3c7',        // ✅ CHANGÉ: était 'rgba(255, 165, 0, 0.3)'
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',                  // ✅ CHANGÉ: était 'white'
  },
  footer: {
    backgroundColor: '#ffffff',        // ✅ CHANGÉ: était '#1e2936'
    paddingVertical: 18,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',        // ✅ CHANGÉ: était '#2c3e50'
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 8,
  },
  
  // Context menu - GARDÉ IDENTIQUE car déjà clair
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: 'white',
    borderRadius: 12,                  // ✅ CHANGÉ: était 8 (plus arrondi)
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },  // ✅ CHANGÉ: était 2
    shadowOpacity: 0.15,               // ✅ CHANGÉ: était 0.25
    shadowRadius: 12,                  // ✅ CHANGÉ: était 10
    elevation: 10,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contextMenuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',        // ✅ CHANGÉ: était '#f0f0f0'
  },
  contextMenuText: {
    fontSize: 16,
    color: '#1e293b',                  // ✅ CHANGÉ: était '#333'
    marginLeft: 12,
  },
  contextMenuTextDanger: {
    color: '#dc2626',                  // ✅ CHANGÉ: était '#e74c3c'
  },
  
  // Styles pour la vue Assignments
   assignmentsHeader: {
    backgroundColor: '#ffffff',        
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 15 : 25,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  assignmentsTitle: {
    color: '#1e293b',                  // ✅ CHANGÉ: était 'white'
    fontSize: 20,
    fontWeight: '700',                 // ✅ CHANGÉ: était '600'
  },
  newAssignmentContainer: {
    padding: 16,
    backgroundColor: '#f8fafc',        // ✅ CHANGÉ: était '#2c3e50'
  },
  newAssignmentButtonFull: {
    backgroundColor: '#0ea5e9',        // ✅ CHANGÉ: était '#5B9BD5'
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,                  // ✅ CHANGÉ: était 10
    // ✅ AJOUTÉ: Ombre moderne
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  newAssignmentTextFull: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  assignmentsList: {
    flex: 1,
    backgroundColor: '#f8fafc',        // ✅ CHANGÉ: était '#34495e'
  },
  emptyAssignments: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyAssignmentsText: {
    fontSize: 16,
    color: '#64748b',                  // ✅ CHANGÉ: était '#6c7680'
    marginTop: 20,
  },
  assignmentCard: {
    backgroundColor: '#ffffff',        // ✅ CHANGÉ: était '#2c3e50'
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,                  // ✅ CHANGÉ: était 10 (plus arrondi)
    padding: 20,                       // ✅ CHANGÉ: était 16 (plus d'espace)
    // ✅ AJOUTÉ: Ombre moderne
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardTouchable: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  cardAddress: {
    fontSize: 16,
    fontWeight: '700',                 // ✅ CHANGÉ: était 'bold'
    color: '#1e293b',                  // ✅ CHANGÉ: était '#ffffff'
    marginLeft: 8,
    flex: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapsButton: {
    backgroundColor: '#10b981',        // ✅ CHANGÉ: était '#27ae60' (vert plus moderne)
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    shadowColor: '#10b981',            // ✅ CHANGÉ: Ombre colorée
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
cardClient: {
  fontSize: 14,
  color: '#1e293b',  // Changé de #64748b pour être plus visible
  marginBottom: 4,
  fontWeight: '500',  // Ajouté pour plus de lisibilité
},
  statusBadgeNew: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,                   // ✅ CHANGÉ: était 4 (plus arrondi)
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',        // GARDÉ IDENTIQUE (déjà clair)
  },
  completedBadge: {
    backgroundColor: '#d1fae5',        // ✅ CHANGÉ: était '#10B981' (version plus claire)
  },
  statusTextNew: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',                  // GARDÉ IDENTIQUE (déjà bien)
  },
  detailsRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  detailText: {
    fontSize: 13,
    color: '#64748b',                  // ✅ CHANGÉ: était '#b0b3b8'
    marginLeft: 6,
  },
  notesContainer: {
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: '#f1f5f9',        // ✅ CHANGÉ: était '#1e3a5f'
    borderWidth: 1,
    borderColor: '#e2e8f0',            // ✅ CHANGÉ: était '#2a5a8f'
    borderRadius: 8,                   // ✅ CHANGÉ: était 6
    padding: 12,                       // ✅ CHANGÉ: était 10
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0ea5e9',                  // ✅ CHANGÉ: était '#5B9BD5'
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#64748b',                  // ✅ CHANGÉ: était '#b0b3b8'
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,               // ✅ CHANGÉ: était 10
    borderRadius: 8,                   // ✅ CHANGÉ: était 6
    borderWidth: 1.5,                  // ✅ CHANGÉ: était 1
    marginHorizontal: 5,
  },
  viewButton: {
    backgroundColor: '#f1f5f9',        // ✅ CHANGÉ: était '#34495e'
    borderColor: '#e2e8f0',            // ✅ CHANGÉ: était '#4a5568'
  },
  calculateButton: {
    backgroundColor: '#10b981',        // GARDÉ IDENTIQUE (déjà bien)
    borderColor: '#10b981',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',                 // ✅ CHANGÉ: était '500'
    color: '#64748b',                  // ✅ CHANGÉ: était '#ffffff'
    marginLeft: 6,
  },
  calculateButtonText: {
    color: 'white',                    // GARDÉ pour le bouton vert
  },
  
  // Styles existants
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assignmentInfo: {
    flex: 1,
    marginRight: 10,
  },
  assignmentTitle: {
    color: '#1e293b',                  // ✅ CHANGÉ: était '#ffffff'
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  assignmentAddress: {
    color: '#64748b',                  // ✅ CHANGÉ: était '#8e9297'
    fontSize: 14,
    marginBottom: 3,
  },
  assignmentNotes: {
    color: '#94a3b8',                  // ✅ CHANGÉ: était '#6c7680'
    fontSize: 12,
    fontStyle: 'italic',
  },
  assignmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  assignmentDate: {
    color: '#94a3b8',                  // ✅ CHANGÉ: était '#6c7680'
    fontSize: 12,
  },
  assignmentSubtitle: {
    color: '#64748b',                  // ✅ CHANGÉ: était '#8e9297'
    fontSize: 13,
    marginTop: 2,
    fontStyle: 'italic',
  },
  // Styles pour l'affichage spécifique des assignments
clientInfoRow: {
  marginTop: 8,
  marginBottom: 4,
},
phoneRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginVertical: 6,
  paddingVertical: 4,
},
phoneText: {
  fontSize: 14,
  color: '#0ea5e9',
  marginLeft: 8,
  textDecorationLine: 'underline',
  fontWeight: '500',
},
dateRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
},
dateText: {
  fontSize: 12,
  color: '#64748b',
  marginLeft: 8,
},
searchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#f3f4f6',
  marginHorizontal: 16,
  marginBottom: 12,
  marginTop: -8, // Pour rapprocher du header
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#e5e7eb',
},
searchIcon: {
  marginRight: 10,
},
searchInput: {
  flex: 1,
  fontSize: 16,
  color: '#1f2937',
  padding: 0,
},
clearButton: {
  padding: 4,
},
searchResults: {
  paddingHorizontal: 16,
  paddingBottom: 8,
  marginTop: -8,
},
searchResultsText: {
  fontSize: 14,
  color: '#6b7280',
  fontStyle: 'italic',
},

});