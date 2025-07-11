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
  ActivityIndicator
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';

// Imports Firebase et synchronisation
import { subscribeToSubmissions, createAssignment, updateSubmissionStatus, deleteSubmissionFromFirebase, saveSubmission } from './firebaseFunctions';
import { subscribeToFolders, saveFolderToFirebase, updateFolderInFirebase, deleteFolderFromFirebase } from './folderSyncFunctions';
import { testFirebaseConnection } from './firebase';

// Imports composants
import SoumissionForm from './components/SoumissionForm';
import FolderManagementModal from './FolderManagementModal';
import AssignmentModal from './AssignmentModal';

// Les 3 dossiers protégés (essentiels au fonctionnement)
const PROTECTED_FOLDER_IDS = [
  'system_assignments',
  'system_pending',
  'system_completed'
];

export default function App() {
  // États principaux
  const [submissions, setSubmissions] = useState([]);
  const [folders, setFolders] = useState({});
  const [loading, setLoading] = useState(true);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  
  // États navigation
  const [currentView, setCurrentView] = useState('dashboard');
  const [previousView, setPreviousView] = useState('dashboard');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  
  // États UI
  const [expandedFolders, setExpandedFolders] = useState([]);
  const [folderModal, setFolderModal] = useState({ visible: false, folder: null, parentFolder: null });
  const [folderMenuVisible, setFolderMenuVisible] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  // Initialisation et synchronisation
  useEffect(() => {
    let unsubscribeSubmissions = null;
    let unsubscribeFolders = null;

    const initializeApp = async () => {
      console.log('🔥 Initialisation app mobile...');
      
      try {
        const connected = await testFirebaseConnection();
        setFirebaseConnected(connected);
        
        if (connected) {
          // S'abonner aux changements de dossiers (temps réel)
          unsubscribeFolders = subscribeToFolders((result) => {
            if (result.success) {
              const foldersMap = {};
              
              result.data.forEach(folder => {
                foldersMap[folder.id] = {
                  ...folder,
                  filter: folder.filterConfig 
                    ? (submissions) => applyFolderFilter(folder, submissions)
                    : (submissions) => submissions.filter(s => s.folderId === folder.id)
                };
              });
              
              setFolders(foldersMap);
              console.log(`✅ ${result.data.length} dossiers synchronisés`);
            }
          });
          
          // S'abonner aux soumissions
          unsubscribeSubmissions = subscribeToSubmissions((result) => {
            if (result.success) {
              setSubmissions(result.data);
              console.log(`✅ ${result.count} soumissions chargées`);
            }
          });
        }
      } catch (error) {
        console.error('❌ Erreur initialisation:', error);
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

  // Appliquer le filtre d'un dossier
  const applyFolderFilter = (folder, submissions) => {
    if (!folder.filterConfig) return [];
    
    const { filterConfig } = folder;
    
    if (filterConfig.type === 'status') {
      return submissions.filter(s => s.status === filterConfig.value);
    }
    
    return [];
  };

  // Gérer la création/modification de dossier
  const handleSaveFolder = async (folderData) => {
    try {
      if (folderData.id) {
        // Modification
        const result = await updateFolderInFirebase(folderData.id, {
          label: folderData.label,
          icon: folderData.icon,
          color: folderData.color
        }, 'mobile');
        
        if (result.success) {
          Alert.alert('Succès', `"${folderData.label}" a été modifié`);
        }
      } else {
        // Création
        const newFolder = {
          label: folderData.label,
          icon: folderData.icon,
          color: folderData.color,
          order: Object.keys(folders).length,
          level: folderData.parentId ? 1 : 0,
          parentId: folderData.parentId || null,
          parentLabel: folderData.parentLabel || null,
          isSystemFolder: false,
          filterConfig: null
        };
        
        const result = await saveFolderToFirebase(newFolder, 'mobile');
        
        if (result.success) {
          Alert.alert('Succès', `"${folderData.label}" a été créé`);
        }
      }
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
    
    setFolderModal({ visible: false, folder: null, parentFolder: null });
  };

  // Supprimer un dossier
  const handleDeleteFolder = async (folderId, folderLabel) => {
    // Vérifier si c'est un dossier protégé
    if (PROTECTED_FOLDER_IDS.includes(folderId)) {
      Alert.alert('Dossier protégé', 'Ce dossier système ne peut pas être supprimé');
      return;
    }
    
    Alert.alert(
      'Confirmer la suppression',
      `Supprimer le dossier "${folderLabel}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteFolderFromFirebase(folderId);
              if (result.success) {
                Alert.alert('Succès', 'Dossier supprimé');
                if (selectedFolder === folderId) {
                  setSelectedFolder('system_assignments');
                }
              }
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          }
        }
      ]
    );
  };

  // Créer un nouvel assignment
  const handleCreateAssignment = async (assignmentData) => {
    try {
      const modifiedData = {
        ...assignmentData,
        displayName: assignmentData.client.adresse
      };
      
      const result = await createAssignment(modifiedData);
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
              const result = await deleteSubmissionFromFirebase(submissionId);
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

  // Retour au dashboard
  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedSubmission(null);
  };

  // Toggle dossier étendu
  const toggleFolder = (folderId) => {
    setExpandedFolders(prev =>
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  // Obtenir les soumissions filtrées
  const getFilteredSubmissions = () => {
    const folder = folders[selectedFolder];
    if (!folder || !folder.filter) return [];
    return folder.filter(submissions);
  };

  // Organiser les dossiers en hiérarchie
  const getOrganizedFolders = () => {
    const rootFolders = [];
    const folderMap = {};
    const seenIds = new Set();
    
    // Créer une map de tous les dossiers EN ÉLIMINANT LES DOUBLONS
  Object.values(folders).forEach(folder => {
    if (!seenIds.has(folder.id)) { // NOUVEAU: Vérifier si on a déjà vu cet ID
      seenIds.add(folder.id);
      folderMap[folder.id] = { ...folder, children: [] };
    }
  });
    
    // Créer une map de tous les dossiers
    Object.values(folders).forEach(folder => {
      folderMap[folder.id] = { ...folder, children: [] };
    });
    
    // Forcer l'ordre pour les dossiers système
    const systemOrder = {
      'system_assignments': 0,
      'system_pending': 1,
      'system_completed': 2
    };
    
    // Organiser en hiérarchie
    Object.values(folderMap).forEach(folder => {
      if (folder.parentId && folderMap[folder.parentId]) {
        folderMap[folder.parentId].children.push(folder);
      } else if (!folder.parentId) {
        rootFolders.push(folder);
      }
    });
    
    // Trier par ordre avec priorité aux dossiers système
    rootFolders.sort((a, b) => {
      if (systemOrder.hasOwnProperty(a.id)) {
        a.order = systemOrder[a.id];
      }
      if (systemOrder.hasOwnProperty(b.id)) {
        b.order = systemOrder[b.id];
      }
      
      const orderA = a.order !== undefined ? a.order : 999;
      const orderB = b.order !== undefined ? b.order : 999;
      return orderA - orderB;
    });
    
    // Trier aussi les sous-dossiers
    Object.values(folderMap).forEach(folder => {
      if (folder.children) {
        folder.children.sort((a, b) => {
          const orderA = a.order !== undefined ? a.order : 999;
          const orderB = b.order !== undefined ? b.order : 999;
          return orderA - orderB;
        });
      }
    });
    
    return rootFolders;
  };

  // Rendu d'un dossier
  const renderFolder = (folder, level = 0) => {
    const isSelected = selectedFolder === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;
    const isExpanded = expandedFolders.includes(folder.id);
    const isProtected = PROTECTED_FOLDER_IDS.includes(folder.id);
    const count = folder.filter ? folder.filter(submissions).length : 0;
    
    return (
       <View>
        <View style={[styles.folderItem, isSelected && styles.folderItemSelected]}>
          <TouchableOpacity
            style={[styles.folderContent, { paddingLeft: 16 + level * 20 }]}
            onPress={() => {
              console.log('📁 Clic sur dossier:', folder.label, '| ID:', folder.id);
              
              if (hasChildren) {
                console.log('📂 Toggle expansion pour:', folder.label);
                toggleFolder(folder.id);
                return;
              }
              
              if (folder.id === 'system_assignments' || 
                  folder.id === 'system_pending' || 
                  folder.id === 'system_completed') {
                console.log('🎯 Navigation vers vue séparée:', folder.label);
                setSelectedFolder(folder.id);
                setCurrentView('folderView');
                return;
              }
              
              // Comportement normal pour les autres dossiers
              if (selectedFolder === folder.id) {
                setSelectedFolder(null);
              } else {
                setSelectedFolder(folder.id);
              }
            }}
          >
            {hasChildren && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.id);
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
            
            {!isProtected && (
              <TouchableOpacity
                onPress={() => setFolderMenuVisible(folder.id)}
                style={styles.moreButton}
              >
                <FontAwesome5 name="ellipsis-v" size={16} color="#6c7680" />
              </TouchableOpacity>
            )}
            
            {isProtected && count > 0 && (
              <FontAwesome5 
                name={isSelected ? "chevron-down" : "chevron-right"} 
                size={14} 
                color="#6c7680" 
                style={{ marginLeft: 8 }}
              />
            )}
          </View>
        </View>
        
        {/* Menu contextuel */}
        {folderMenuVisible === folder.id && (
          <Modal
            transparent
            visible={true}
            onRequestClose={() => setFolderMenuVisible(null)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setFolderMenuVisible(null)}
            >
              <View style={styles.contextMenu}>
                {level === 0 && (
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => {
                      setFolderModal({ visible: true, folder: null, parentFolder: folder });
                      setFolderMenuVisible(null);
                    }}
                  >
                    <FontAwesome5 name="plus" size={14} color="#333" />
                    <Text style={styles.contextMenuText}>Ajouter sous-dossier</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => {
                    setFolderModal({ visible: true, folder: folder, parentFolder: null });
                    setFolderMenuVisible(null);
                  }}
                >
                  <FontAwesome5 name="edit" size={14} color="#333" />
                  <Text style={styles.contextMenuText}>Modifier</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.contextMenuItem, styles.contextMenuItemDanger]}
                  onPress={() => {
                    handleDeleteFolder(folder.id, folder.label);
                    setFolderMenuVisible(null);
                  }}
                >
                  <FontAwesome5 name="trash" size={14} color="#e74c3c" />
                  <Text style={[styles.contextMenuText, styles.contextMenuTextDanger]}>
                    Supprimer
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
        
        {/* Sous-dossiers */}
        {hasChildren && isExpanded && (
          <View>
            {folder.children.map((child, index) => (
  <View key={`${child.id}_${index}`}>
    {renderFolder(child, level + 1)}
  </View>
))}
          </View>
        )}
      </View>
    );
  };

  // Dashboard principal
  const renderDashboard = () => {
    const currentFolder = folders[selectedFolder];
    const filteredSubmissions = getFilteredSubmissions();
    
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
              <Text style={styles.appVersion}>Mobile v16</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeButton}>
            <FontAwesome5 name="times" size={28} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* Bouton nouvelle soumission */}
        <View style={styles.newButtonContainer}>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => {
              setPreviousView('dashboard');
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
            <TouchableOpacity
              onPress={() => setFolderModal({ visible: true, folder: null, parentFolder: null })}
              style={styles.addFolderButton}
            >
              <FontAwesome5 name="plus" size={24} color="#5a6772" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.mainScrollView} showsVerticalScrollIndicator={false}>
            {/* Rendu de tous les dossiers et leur contenu */}
           {getOrganizedFolders().map((folder, folderIndex) => (
  <View key={`folder_${folder.id}_${folderIndex}`}>
    {renderFolder(folder)}
                
                {/* Afficher les soumissions si le dossier est sélectionné */}
                {selectedFolder === folder.id && 
                 folder.id !== 'system_assignments' && 
                 folder.id !== 'system_pending' && 
                 folder.id !== 'system_completed' && 
                 (!folder.children || folder.children.length === 0) && (
                  <View style={styles.submissionsContainer}>
                    {/* Header du dossier avec options */}
                    {folder.id === 'system_assignments' && (
                      <View style={styles.folderHeaderBar}>
                        <Text style={styles.folderHeaderTitle}>{folder.label}</Text>
                        <TouchableOpacity
                          style={styles.newAssignmentButton}
                          onPress={() => setShowAssignmentModal(true)}
                        >
                          <FontAwesome5 name="plus" size={14} color="white" />
                          <Text style={styles.newAssignmentText}>Nouvel assignment</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    {/* Liste des soumissions */}
                    {filteredSubmissions.length === 0 ? (
                      <Text style={styles.noSubmissionsText}>Aucune soumission dans ce dossier</Text>
                    ) : (
                      filteredSubmissions.map(submission => (
                        <TouchableOpacity
                          key={submission.id}
                          style={styles.submissionItem}
                          onPress={() => {
                            setPreviousView('dashboard');
                            handleNavigateToForm(submission);
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
                            <View style={[
                              styles.statusBadge,
                              submission.status === 'assignment' && styles.statusAssignment,
                              submission.status === 'captured' && styles.statusPending,
                              submission.status === 'completed' && styles.statusCompleted
                            ]}>
                              <Text style={styles.statusText}>
                                {submission.status === 'assignment' ? 'Assignment' : 
                                 submission.status === 'captured' ? 'À compléter' : 'Terminée'}
                              </Text>
                            </View>
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
        
        {/* Modals */}
        <FolderManagementModal
          visible={folderModal.visible}
          onClose={() => setFolderModal({ visible: false, folder: null, parentFolder: null })}
          onSave={handleSaveFolder}
          folder={folderModal.folder}
          parentFolder={folderModal.parentFolder}
        />
        
        <AssignmentModal
          visible={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          onSubmit={handleCreateAssignment}
        />
      </SafeAreaView>
    );
  };

  // Vue Folder séparée (MODIFIÉE AVEC LE NOUVEAU STYLE)
  const renderFolderView = () => {
    const currentFolder = folders[selectedFolder];
    const filteredSubmissions = getFilteredSubmissions();
    const canCreateNew = selectedFolder === 'system_assignments';
    
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
        
        {/* Bouton nouvel assignment SEULEMENT pour "Aller prendre mesure" */}
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
        
        {/* Liste des soumissions AVEC LE NOUVEAU STYLE */}
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
            // NOUVEAU STYLE POUR LES CARTES
            filteredSubmissions.map(submission => {
              const isCompleted = submission.status === 'completed';
              const isPending = submission.status === 'captured' || submission.status === 'pending' || !submission.status;
              
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
                  style={[styles.assignmentCard, isCompleted && styles.completedCard]}
                >
                  {/* En-tête avec adresse et badge statut */}
                  <View style={styles.cardHeader}>
                    <FontAwesome5 name="home" size={14} color="#3498db" />
                    <Text style={styles.cardAddress} numberOfLines={1}>
                      {submission.client?.adresse || submission.displayName || 'Adresse inconnue'}
                    </Text>
                    <View style={[styles.statusBadgeNew, isPending && styles.pendingBadge, isCompleted && styles.completedBadge]}>
                      <Text style={styles.statusTextNew}>
                        {submission.status === 'assignment' ? 'Assignment' :
                         isCompleted ? 'Terminée' : 'À compléter'}
                      </Text>
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
                  
                  {/* Boutons Voir et Calculer */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.viewButton]}
                      onPress={() => {
                        setPreviousView('folderView');
                        handleNavigateToForm(submission);
                      }}
                    >
                      <FontAwesome5 name="eye" size={14} color="#374151" />
                      <Text style={styles.buttonText}>Voir</Text>
                    </TouchableOpacity>
                    
                    {isPending && (
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.calculateButton]}
                        onPress={async () => {
                          try {
                            const updatedSubmission = {
                              ...submission,
                              needsCalculation: true,
                              calculationRequestedAt: new Date().toISOString()
                            };
                            
                            await saveSubmission(updatedSubmission);
                            Alert.alert('Succès', 'Soumission marquée pour calcul au bureau');
                          } catch (error) {
                            Alert.alert('Erreur', 'Impossible de marquer pour calcul');
                          }
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
        onComplete={() => { 
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

// STYLES - J'AI AJOUTÉ SEULEMENT LES NOUVEAUX STYLES NÉCESSAIRES
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
  statusCompleted: {
    backgroundColor: 'rgba(74, 222, 128, 0.3)',
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
  
  // NOUVEAUX STYLES POUR L'AFFICHAGE AMÉLIORÉ
  completedCard: {
    backgroundColor: '#1a4d3a',
    borderWidth: 1,
    borderColor: '#2d7a5a',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
    flex: 1,
    marginRight: 8,
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
    backgroundColor: '#D1FAE5',
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