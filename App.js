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

// Import du nouveau système unifié
import FirebaseSync from './firebaseSync';

// Imports composants
import SoumissionForm from './components/SoumissionForm';
import AssignmentModal from './AssignmentModal';
import SubmissionViewer from './components/SubmissionViewer';

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
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  
  // États UI
  const [expandedFolders, setExpandedFolders] = useState(['projet_2025']); // Slug au lieu d'ID
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showSubmissionViewer, setShowSubmissionViewer] = useState(false);
  const [viewerSubmission, setViewerSubmission] = useState(null);

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

  // Créer un nouvel assignment
  const handleCreateAssignment = async (assignmentData) => {
    try {
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
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer l\'assignment');
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

 const getFilteredSubmissions = (folderSlug = null) => {
  const targetSlug = folderSlug || selectedFolder;
  
  if (!targetSlug) {
    console.log('❌ Aucun dossier sélectionné');
    return [];
  }
  
  console.log(`📱 Mobile - Filtrage pour: "${targetSlug}"`);
  
  // 🔧 CAS SPÉCIAUX : Dossiers custom Soumissions
  if (targetSlug === 'projet_2025_soumissions') {
    const filtered = submissions.filter(s => s.folderId === 'projet_2025_soumissions');
    console.log(`📱 Mobile - Soumissions custom: ${filtered.length} soumissions`);
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
    const filtered = folder.filterFn(submissions);
    console.log(`📱 Mobile - Filtre système "${folder.label}": ${filtered.length} soumissions`);
    return filtered;
  }
  
  // Fallback pour autres dossiers personnalisés
  const filtered = submissions.filter(s => s.folderId === targetSlug);
  console.log(`📱 Mobile - Filtre folderId "${targetSlug}": ${filtered.length} soumissions`);
  
  return filtered;
};

  // 🔧 FONCTION CORRIGÉE - Organiser les dossiers en hiérarchie
  const getOrganizedFolders = () => {
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
    
    // Trier par ordre
    rootFolders.sort((a, b) => (a.order || 999) - (b.order || 999));
    
    // Trier aussi les sous-dossiers
    Object.values(folderMap).forEach(folder => {
      if (folder.children && folder.children.length > 0) {
        folder.children.sort((a, b) => (a.order || 999) - (b.order || 999));
      }
    });
    
    return rootFolders;
  };

  // 🔧 FONCTION CORRIGÉE - Rendu d'un dossier
  const renderFolder = (folder, level = 0) => {
    const isSelected = selectedFolder === folder.slug;
    const hasChildren = folder.children && folder.children.length > 0;
    const isExpanded = expandedFolders.includes(folder.slug);
    
    // Calculer le count correctement
    let count = 0;
    if (folder.filterFn) {
      count = folder.filterFn(submissions).length;
    }
    
    // Si c'est un dossier parent, compter aussi les soumissions des enfants
    if (hasChildren) {
      folder.children.forEach(child => {
        if (child.filterFn) {
          count += child.filterFn(submissions).length;
        }
      });
    }
    
    return (
      <View key={folder.slug}>
        <View style={[
          styles.folderItem, 
          isSelected && styles.folderItemSelected
        ]}>
          <TouchableOpacity
            style={[styles.folderContent, { paddingLeft: 16 + level * 20 }]}
            onPress={() => {
              console.log('📁 Clic sur dossier:', folder.label, '| Slug:', folder.slug);
              console.log('📱 CLIC DOSSIER:', folder.id, '| Label:', folder.label);
              setSelectedFolder(folder.id);
              console.log('📱 selectedFolder défini à:', folder.id);
              setCurrentView('folderView');
              
              // Si c'est un dossier parent avec des enfants, toggle l'expansion
              if (hasChildren && level === 0) {
                console.log('📂 Toggle expansion pour:', folder.label);
                toggleFolder(folder.slug);
                return;
              }
              
              // Pour les dossiers système principaux, ouvrir la vue séparée
              if (folder.slug === 'assignments' || 
                  folder.slug === 'pending' ||
                  folder.slug === 'completed') {
                console.log('🎯 Navigation vers vue séparée:', folder.label);
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
              name={folder.icon || 'folder'}
              size={16}
              color={folder.color || '#6b7280'}
              style={styles.folderIcon}
            />
            
            <Text style={[styles.folderLabel, isSelected && styles.folderLabelSelected]}>
              {folder.label}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.folderActions}>
            {count > 0 && (
              <View style={styles.folderBadge}>
                <Text style={styles.folderBadgeText}>{count}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Sous-dossiers */}
        {hasChildren && isExpanded && (
          <View>
            {folder.children.map((child) => renderFolder(child, level + 1))}
          </View>
        )}
      </View>
    );
  };

  // Dashboard principal
  const renderDashboard = () => {
    const currentFolder = folders[selectedFolder];
    const filteredSubmissions = getFilteredSubmissions();

    // 🔧 DANS renderDashboard(), APRÈS la ligne "const filteredSubmissions = getFilteredSubmissions();"
// AJOUTEZ CES LIGNES DE DEBUG :

// DEBUG TEMPORAIRE
console.log('🔍 DEBUG MOBILE renderDashboard:');
console.log('   📁 selectedFolder:', selectedFolder);
console.log('   📂 currentFolder:', currentFolder);
console.log('   📄 submissions total:', submissions.length);
console.log('   🎯 filteredSubmissions:', filteredSubmissions.length);

// Test spécifique pour notre dossier
if (selectedFolder === 'projet_2025_soumissions') {
  const directTest = submissions.filter(s => s.folderId === 'projet_2025_soumissions');
  console.log('   🔧 Test direct projet_2025_soumissions:', directTest.length);
  directTest.forEach((s, i) => {
    console.log(`      ${i+1}. ${s.client?.adresse || s.id}`);
  });
}

// Lister tous les folderId disponibles
const folderIds = [...new Set(submissions.map(s => s.folderId).filter(Boolean))];
console.log('   📋 FolderIds disponibles:', folderIds);
    
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#1e2936" />
        
        {/* Header principal */}
        <View style={styles.mainHeader}>
          <View style={styles.appInfo}>
            <View style={styles.appIcon}>
              <FontAwesome5 name="home" size={24} color="white" />
            </View>
            <View>
              <Text style={styles.appTitle}>Soumission Toiture</Text>
            </View>
          </View>
        </View>
        
        {/* Bouton nouvelle soumission */}
        <View style={styles.newButtonContainer}>
          <TouchableOpacity
            style={styles.newButton}
            onPress={async () => {
              setPreviousView('dashboard');
              
              try {
                // Vérifier s'il y a un brouillon
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
            {/* Rendu de tous les dossiers et leur contenu */}
            {getOrganizedFolders().map((folder) => (
              <View key={folder.slug}>
                {renderFolder(folder)}
                
                {/* Afficher les soumissions si le dossier est sélectionné ET n'est pas un dossier système */}
                {selectedFolder === folder.slug && 
                 folder.slug !== 'assignments' && 
                 folder.slug !== 'pending' && 
                 folder.slug !== 'completed' && (
                  <View style={styles.submissionsContainer}>
                    {/* Liste des soumissions */}
                    {filteredSubmissions.length === 0 ? (
                      <Text style={styles.noSubmissionsText}>Aucune soumission dans ce dossier</Text>
                    ) : (
                      filteredSubmissions.map(submission => (
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
                              submission.client?.adresse || submission.displayName || 'Cette soumission',
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
                                    submission.client?.adresse || submission.displayName || 'cette soumission'
                                  )
                                }
                              ]
                            );
                          }}
                        >
                          <View style={styles.submissionContent}>
                            <Text style={styles.submissionTitle}>
                              {submission.client?.adresse || submission.displayName || submission.client?.nom || 'Sans nom'}
                            </Text>
                            {submission.client?.nom && submission.client?.adresse && (
                              <Text style={styles.submissionSubtitle}>Client: {submission.client.nom}</Text>
                            )}
                            {submission.notes && (
                              <Text style={styles.submissionNotes} numberOfLines={1}>
                                {submission.notes}
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
                                <Text style={styles.photoCount}>{submission.photos.length}</Text>
                              </View>
                            )}
                            <FontAwesome5 name="chevron-right" size={14} color="#6c7680" />
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            ))}
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
              {firebaseConnected ? 'Synchronisé' : 'Hors ligne'}
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
  const renderFolderView = () => {
    const currentFolder = folders[selectedFolder];
    const filteredSubmissions = getFilteredSubmissions();
    const canCreateNew = selectedFolder === 'assignments';
    
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#1e2936" />
        
        {/* Header avec bouton retour */}
        <View style={styles.assignmentsHeader}>
          <TouchableOpacity 
            onPress={() => {
              setSelectedFolder(null);
              setCurrentView('dashboard');
            }}
            style={styles.backButton}
          >
            <FontAwesome5 name="arrow-left" size={20} color="white" />
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
              
              // Calculer la superficie
              const getSuperficie = () => {
                let superficie = 0;
                if (submission.toiture?.superficie) {
                  Object.values(submission.toiture.superficie).forEach(val => {
                    superficie += parseFloat(val) || 0;
                  });
                }
                if (submission.clientInfo?.roofInfo?.totalSuperficie) {
                  superficie = submission.clientInfo.roofInfo.totalSuperficie;
                }
                return superficie || 0;
              };
              
              const photoCount = submission.photos?.length || 0;
              
              return (
                <View
                  key={submission.id}
                  style={styles.assignmentCard}
                >
                  {/* Wrapper pour le longPress */}
                  <TouchableOpacity
                    style={styles.cardTouchable}
                    onLongPress={() => {
                      Alert.alert(
                        'Options',
                        submission.client?.adresse || submission.displayName || 'Cette soumission',
                        [
                          { text: 'Annuler', style: 'cancel' },
                          { 
                            text: 'Modifier', 
                            onPress: () => {
                              setPreviousView('folderView');
                              handleNavigateToForm(submission);
                            }
                          },
                          {
                            text: 'Supprimer',
                            style: 'destructive',
                            onPress: () => handleDeleteSubmission(
                              submission.id, 
                              submission.client?.adresse || submission.displayName || 'cette soumission'
                            )
                          }
                        ]
                      );
                    }}
                    delayLongPress={500}
                    activeOpacity={1}
                  >
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
                            openAddressInMaps(submission.client?.adresse || submission.displayName);
                          }}
                          style={[
                            styles.mapsButton,
                            { opacity: (submission.client?.adresse || submission.displayName) ? 1 : 0.5 }
                          ]}
                          disabled={!submission.client?.adresse && !submission.displayName}
                        >
                          <FontAwesome5 name="map-marker-alt" size={14} color="white" />
                        </TouchableOpacity>
                        
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
                      </View>
                    </View>
                    
                    {/* Nom du client */}
                    {submission.client?.nom && (
                      <Text style={styles.cardClient}>Client: {submission.client.nom}</Text>
                    )}
                    
                    {/* Superficie et photos */}
                    <View style={styles.detailsRow}>
                      <View style={styles.detailItem}>
                        <FontAwesome5 name="ruler-combined" size={12} color="#666" />
                        <Text style={styles.detailText}>Superficie: {getSuperficie().toFixed(0)} pi²</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <FontAwesome5 name="camera" size={12} color="#666" />
                        <Text style={styles.detailText}>Photos: {photoCount}</Text>
                      </View>
                    </View>
                    
                    {/* Notes si présentes */}
                    {submission.notes && (
                      <View style={styles.notesContainer}>
                        <Text style={styles.notesTitle}>Notes:</Text>
                        <Text style={styles.notesText} numberOfLines={2}>{submission.notes}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  {/* Boutons Voir/Mesurer et Calculer */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.viewButton]}
                      onPress={() => {
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
                    
                    {isPending && selectedFolder !== 'completed' && (
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.calculateButton]}
                        onPress={() => {
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
                  
                </View>
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
        
        {/* Modal Assignment */}
        {canCreateNew && (
          <AssignmentModal
            visible={showAssignmentModal}
            onClose={() => setShowAssignmentModal(false)}
            onSubmit={handleCreateAssignment}
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


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e2936',
  },
  mainHeader: {
    backgroundColor: '#2c3e50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#5B9BD5',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  appTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  appVersion: {
    color: '#8e9297',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  newButtonContainer: {
    padding: 16,
    backgroundColor: '#2c3e50',
  },
  newButton: {
    backgroundColor: '#5B9BD5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  newButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  
  mainContent: {
    flex: 1,
    backgroundColor: '#2c3e50',
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
    color: '#8e9297',
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
  },
  folderItemSelected: {
    backgroundColor: 'rgba(91, 155, 213, 0.15)',
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
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  folderLabelSelected: {
    fontWeight: '500',
  },
  folderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderBadge: {
    backgroundColor: '#5a6772',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginRight: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  folderBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  moreButton: {
    padding: 6,
  },
  submissionsContainer: {
    backgroundColor: '#34495e',
    marginTop: 5,
    marginBottom: 10,
  },
  folderHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2c3e50',
  },
  folderHeaderTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  newAssignmentButton: {
    backgroundColor: '#5B9BD5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  newAssignmentText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 5,
  },
  noSubmissionsText: {
    color: '#8e9297',
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
    borderBottomWidth: 1,
    borderBottomColor: '#2c3e50',
  },
  submissionContent: {
    flex: 1,
    marginRight: 10,
  },
  submissionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  submissionSubtitle: {
    color: '#8e9297',
    fontSize: 13,
    marginBottom: 2,
  },
  submissionNotes: {
    color: '#6c7680',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 3,
  },
  submissionDate: {
    color: '#6c7680',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  photoCount: {
    color: '#fff',
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
    backgroundColor: 'rgba(91, 155, 213, 0.3)',
  },
  statusPending: {
    backgroundColor: 'rgba(255, 165, 0, 0.3)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  footer: {
    backgroundColor: '#1e2936',
    paddingVertical: 18,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2c3e50',
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
  
  // Context menu
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
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
    borderTopColor: '#f0f0f0',
  },
  contextMenuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  contextMenuTextDanger: {
    color: '#e74c3c',
  },
  
  // Styles pour la vue Assignments
  assignmentsHeader: {
    backgroundColor: '#2c3e50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  assignmentsTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  newAssignmentContainer: {
    padding: 16,
    backgroundColor: '#2c3e50',
  },
  newAssignmentButtonFull: {
    backgroundColor: '#5B9BD5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  newAssignmentTextFull: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  assignmentsList: {
    flex: 1,
    backgroundColor: '#34495e',
  },
  emptyAssignments: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyAssignmentsText: {
    fontSize: 16,
    color: '#6c7680',
    marginTop: 20,
  },
  assignmentCard: {
    backgroundColor: '#2c3e50',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    padding: 16,
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
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
    flex: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapsButton: {
    backgroundColor: '#27ae60',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardClient: {
    fontSize: 14,
    color: '#8e9297',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  statusBadgeNew: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  completedBadge: {
    backgroundColor: '#10B981',
  },
  statusTextNew: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
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
    color: '#b0b3b8',
    marginLeft: 6,
  },
  notesContainer: {
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#2a5a8f',
    borderRadius: 6,
    padding: 10,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5B9BD5',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#b0b3b8',
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
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginHorizontal: 5,
  },
  viewButton: {
    backgroundColor: '#34495e',
    borderColor: '#4a5568',
  },
  calculateButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
    marginLeft: 6,
  },
  calculateButtonText: {
    color: 'white',
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  assignmentAddress: {
    color: '#8e9297',
    fontSize: 14,
    marginBottom: 3,
  },
  assignmentNotes: {
    color: '#6c7680',
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
    color: '#6c7680',
    fontSize: 12,
  },
  assignmentSubtitle: {
    color: '#8e9297',
    fontSize: 13,
    marginTop: 2,
    fontStyle: 'italic',
  },
});