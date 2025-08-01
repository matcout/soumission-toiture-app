import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  Linking
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import FirebaseSync from '../firebaseSync';

const { width, height } = Dimensions.get('window');

const SubmissionViewer = ({ submission, onBack }) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(submission.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  
  // État pour les sections multiples
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  // Format date
  const formatDate = (date) => {
    if (!date) return 'Date inconnue';
    const d = new Date(date);
    return d.toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Obtenir les données pour l'affichage
  const getDisplayData = () => {
    // Si sections multiples et on affiche une section spécifique
    if (submission.hasMultipleSections && submission.sections && currentSectionIndex >= 0 && submission.sections[currentSectionIndex]) {
      const section = submission.sections[currentSectionIndex];
      // Retourner toutes les données de la section, y compris superficie comme objet
      return {
        ...section,
        // Garder superficie comme objet si c'est déjà un objet, sinon créer un objet
        superficie: typeof section.superficie === 'object' 
          ? section.superficie 
          : { 
              totale: section.superficie || 0,
              toiture: section.superficie || 0,  // Utiliser le total comme toiture par défaut
              parapets: 0  // 0 parapets par défaut si pas spécifié
            }
      };
    }
    // Fallback pour les soumissions sans sections multiples
    return {
      sectionName: 'Section principale',
      dimensions: submission.toiture?.dimensions || [],
      parapets: submission.toiture?.parapets || [],
      puitsLumiere: submission.toiture?.puitsLumiere || [],
      photos: submission.photos || [],
      superficie: submission.toiture?.superficie || { totale: 0, toiture: 0, parapets: 0 },
      nbFeuilles: submission.toiture?.nbFeuilles || 0,
      nbDrains: submission.toiture?.nbDrains || 0,
      nbEventsPlomberie: submission.toiture?.nbEventsPlomberie || 0,
      nbAerateurs: submission.toiture?.nbAerateurs || 0,
      nbTrepiedElectrique: submission.toiture?.nbTrepiedElectrique || 0,
      hydroQuebec: submission.toiture?.hydroQuebec || false,
      grue: submission.toiture?.grue || false,
      trackfall: submission.toiture?.trackfall || false,
      plusieursEpaisseurs: submission.toiture?.plusieursEpaisseurs || false,
      notes: submission.notes || ''
    };
  };

  const displayData = getDisplayData();

  // Navigate photos
  const navigatePhoto = (direction) => {
    const photos = displayData.photos;
    if (!photos || photos.length === 0) return;
    
    if (direction === 'prev') {
      setSelectedPhotoIndex(prev => 
        prev > 0 ? prev - 1 : photos.length - 1
      );
    } else {
      setSelectedPhotoIndex(prev => 
        prev < photos.length - 1 ? prev + 1 : 0
      );
    }
  };

  // Ouvrir Google Maps
  const openGoogleMaps = (address) => {
    if (!address || !address.trim()) {
      Alert.alert('Navigation', 'Aucune adresse disponible');
      return;
    }
    
    const encodedAddress = encodeURIComponent(address.trim());
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    
    Linking.openURL(googleMapsUrl);
  };

  // Sauvegarder les notes
  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const result = await FirebaseSync.updateSubmission(submission.id, { 
        notes: editedNotes.trim() 
      });
      
      if (result.success) {
        submission.notes = editedNotes.trim();
        setIsEditingNotes(false);
        Alert.alert('Succès', 'Notes sauvegardées');
      } else {
        throw new Error(result.error || 'Erreur de sauvegarde');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder les notes');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculer superficie totale
  const getSuperficieTotale = () => {
    return displayData.superficie?.totale || 0;
  };

  // Calculer les quantités de matériaux
  const calculateMaterialQuantities = () => {
    const superficie = displayData.superficie?.toiture || 0;
    const parapets = displayData.superficie?.parapets || 0;
    const superficieTotale = superficie + parapets;
    
    return {
      fastNStick: Math.ceil((superficie / 140) * 1.1),
      armourCool: Math.ceil(((superficie + parapets) / 78) * 1.1),
      securePan: Math.ceil((superficie / 32) * 1.1),
      armourBond: Math.ceil((parapets / 98) * 1.15),
      tp180ff: Math.ceil(superficieTotale / 1500)
    };
  };

  const materialQuantities = calculateMaterialQuantities();
  
  // Vérifier puits de lumière
  const hasPuitsLumiere = displayData.puitsLumiere && 
    displayData.puitsLumiere.length > 0 && 
    displayData.puitsLumiere.some(puit => puit.length > 0 || puit.width > 0);

  // Obtenir l'URL d'une photo
  const getPhotoUrl = (photo) => {
    if (typeof photo === 'string') return photo;
    if (photo?.url) return photo.url;
    if (photo?.downloadURL) return photo.downloadURL;
    if (photo?.uri) return photo.uri;
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de la soumission</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Informations client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations client</Text>
          <Text style={styles.clientName}>
            {submission.nom || submission.client?.nom || 'Client non défini'}
          </Text>
          <Text style={styles.clientInfo}>
            📞 {submission.telephone || submission.client?.telephone || 'Non renseigné'}
          </Text>
          <Text style={styles.clientInfo}>
            ✉️ {submission.email || submission.courriel || submission.client?.email || submission.client?.courriel || 'Non renseigné'}
          </Text>
          
          <TouchableOpacity 
            style={styles.addressContainer}
            onPress={() => openGoogleMaps(submission.adresse || submission.client?.adresse)}
          >
            <FontAwesome5 name="map-marker-alt" size={14} color="#3498db" />
            <Text style={styles.addressText}>
              {submission.adresse || submission.client?.adresse || 'Adresse non renseignée'}
            </Text>
            <FontAwesome5 name="external-link-alt" size={12} color="#3498db" />
          </TouchableOpacity>
          
          <Text style={styles.dateText}>
            📅 {formatDate(submission.capturedDate || submission.createdAt)}
          </Text>
        </View>

        {/* Sélecteur de sections si multi-sections */}
        {submission.hasMultipleSections && submission.sections && submission.sections.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Sections du projet ({submission.sections.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.sectionTabs}>
                {submission.sections.map((section, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.sectionTab,
                      currentSectionIndex === index && styles.activeSectionTab
                    ]}
                    onPress={() => setCurrentSectionIndex(index)}
                  >
                    <Text 
                      style={[
                        styles.sectionTabText,
                        currentSectionIndex === index && styles.activeSectionTabText
                      ]}
                    >
                      {section.sectionName || `Section ${index + 1}`}
                    </Text>
                    <Text style={[
                      styles.sectionTabSubtext,
                      currentSectionIndex === index && styles.activeSectionTabSubtext
                    ]}>
                      {typeof section.superficie === 'object' 
                        ? (section.superficie.totale || 0) 
                        : (section.superficie || 0)} pi²
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Nom de la section courante si multi-sections */}
        {submission.hasMultipleSections && displayData.sectionName && (
          <View style={styles.currentSectionHeader}>
            <Text style={styles.currentSectionName}>
              {displayData.sectionName}
            </Text>
            {submission.hasMultipleSections && (
              <Text style={styles.currentSectionInfo}>
                Section {currentSectionIndex + 1} sur {submission.sections.length}
              </Text>
            )}
          </View>
        )}

        {/* Dimensions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Toiture - Dimensions</Text>
          {displayData.dimensions && displayData.dimensions.length > 0 ? (
            displayData.dimensions.map((dim, index) => (
              <Text key={index} style={styles.dimensionText}>
                {dim.name || `Section ${index + 1}`}: {dim.length}' x {dim.width}'
              </Text>
            ))
          ) : (
            <Text style={styles.emptyText}>Aucune dimension</Text>
          )}
        </View>

        {/* Parapets */}
        {displayData.parapets && displayData.parapets.some(p => p.length > 0 || p.width > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parapets</Text>
            {displayData.parapets.map((parapet, index) => (
              parapet.length > 0 || parapet.width > 0 ? (
                <Text key={index} style={styles.dimensionText}>
                  {parapet.name || `Parapet ${index + 1}`}: {parapet.length}' x {parapet.width}'
                </Text>
              ) : null
            ))}
          </View>
        )}

        {/* Puits de lumière */}
        {hasPuitsLumiere && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Puits de lumière</Text>
            {displayData.puitsLumiere.map((puit, index) => (
              <View key={index} style={styles.puitItem}>
                <Text style={styles.puitName}>
                  {puit.name || `Puits ${index + 1}`}
                </Text>
                <Text style={styles.puitDimensions}>
                  {puit.length}' x {puit.width}'
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Superficie */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Superficie</Text>
          <Text style={styles.superficieText}>
            {displayData.superficie?.totale || 0} pi²
          </Text>
          <Text style={styles.totalItems}>
            Toiture: {displayData.superficie?.toiture || 0} pi²
          </Text>
          <Text style={styles.totalItems}>
            Parapets: {displayData.superficie?.parapets || 0} pi²
          </Text>
        </View>

        {/* Matériaux calculés */}
        <View style={[styles.section, styles.materialsSection]}>
          <Text style={styles.sectionTitle}>📦 Matériaux à charger</Text>
          <Text style={styles.materialDate}>Quantités estimées • {new Date().toLocaleDateString('fr-CA')}</Text>
          <View style={styles.materialGrid}>
            <View style={styles.calculatedItem}>
              <Text style={styles.calculatedNumber}>{materialQuantities.fastNStick}</Text>
              <Text style={styles.calculatedLabel}>180 Fast-N-Stick</Text>
            </View>
            <View style={styles.calculatedItem}>
              <Text style={styles.calculatedNumber}>{materialQuantities.armourCool}</Text>
              <Text style={styles.calculatedLabel}>ArmourCool</Text>
            </View>
            <View style={styles.calculatedItem}>
              <Text style={styles.calculatedNumber}>{materialQuantities.securePan}</Text>
              <Text style={styles.calculatedLabel}>SecurePan</Text>
            </View>
            <View style={styles.calculatedItem}>
              <Text style={styles.calculatedNumber}>{materialQuantities.armourBond}</Text>
              <Text style={styles.calculatedLabel}>ArmourBond</Text>
            </View>
            <View style={styles.calculatedItem}>
              <Text style={styles.calculatedNumber}>{materialQuantities.tp180ff}</Text>
              <Text style={styles.calculatedLabel}>TP-180-FF</Text>
            </View>
          </View>
          <Text style={styles.materialNote}>
            {displayData.superficie?.toiture || 0} pi² toiture + {displayData.superficie?.parapets || 0} pi² parapets
          </Text>
        </View>

        {/* Options et extras */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Options et extras</Text>
          {displayData.nbFeuilles > 0 && (
            <Text style={styles.optionText}>• Feuilles de tôle: {displayData.nbFeuilles}</Text>
          )}
          {displayData.nbDrains > 0 && (
            <Text style={styles.optionText}>• Drains: {displayData.nbDrains}</Text>
          )}
          {displayData.nbEventsPlomberie > 0 && (
            <Text style={styles.optionText}>• Évents de plomberie: {displayData.nbEventsPlomberie}</Text>
          )}
          {displayData.nbAerateurs > 0 && (
            <Text style={styles.optionText}>• Aérateurs: {displayData.nbAerateurs}</Text>
          )}
          {displayData.nbTrepiedElectrique > 0 && (
            <Text style={styles.optionText}>• Trépied électrique: {displayData.nbTrepiedElectrique}</Text>
          )}
          {displayData.plusieursEpaisseurs && (
            <Text style={styles.optionText}>• Plusieurs épaisseurs: Oui</Text>
          )}
          {displayData.hydroQuebec && (
            <Text style={styles.optionText}>• Hydro-Québec: Oui</Text>
          )}
          {displayData.grue && (
            <Text style={styles.optionText}>• Grue: Oui</Text>
          )}
          {displayData.trackfall && (
            <Text style={styles.optionText}>• Trackfall: Oui</Text>
          )}
        </View>

        {/* Notes générales */}
        <View style={styles.section}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {!isEditingNotes && (
              <TouchableOpacity onPress={() => setIsEditingNotes(true)}>
                <FontAwesome5 name="edit" size={16} color="#3498db" />
              </TouchableOpacity>
            )}
          </View>
          
          {isEditingNotes ? (
            <View>
              <TextInput
                style={styles.notesInput}
                value={editedNotes}
                onChangeText={setEditedNotes}
                multiline
                placeholder="Ajouter des notes..."
                editable={!isSaving}
              />
              <View style={styles.notesActions}>
                <TouchableOpacity 
                  style={[styles.saveButton, isSaving && styles.disabledButton]}
                  onPress={handleSaveNotes}
                  disabled={isSaving}
                >
                  {isSaving && <ActivityIndicator size="small" color="white" />}
                  <Text style={styles.saveButtonText}>
                    {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setEditedNotes(submission.notes || '');
                    setIsEditingNotes(false);
                  }}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.notesDisplay}>
              <Text style={styles.notesText}>
                {submission.notes || 'Aucune note'}
              </Text>
            </View>
          )}
        </View>

        {/* Photos de la section courante */}
        {displayData.photos && displayData.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({displayData.photos.length})</Text>
            <View style={styles.photoGrid}>
              {displayData.photos.map((photo, index) => {
                const photoUrl = getPhotoUrl(photo);
                
                // Debug : afficher la structure de la photo
                console.log(`Photo ${index + 1}:`, photo);
                console.log(`URL extraite:`, photoUrl);
                
                if (!photoUrl) {
                  return (
                    <View
                      key={index}
                      style={[styles.photoThumbnail, styles.photoPlaceholder]}
                    >
                      <Text style={styles.photoPlaceholderText}>Photo {index + 1}</Text>
                      <Text style={styles.photoPlaceholderSubtext}>Non disponible</Text>
                    </View>
                  );
                }
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoThumbnail}
                    onPress={() => setSelectedPhotoIndex(index)}
                  >
                    <Image 
                      source={{ uri: photoUrl }} 
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                      onError={(e) => {
                        console.error(`Erreur chargement photo ${index + 1}:`, e.nativeEvent.error);
                      }}
                    />
                    <Text style={styles.photoNumber}>{index + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Résumé global si multi-sections */}
        {submission.hasMultipleSections && submission.superficieTotaleGlobale && (
          <View style={{
            backgroundColor: '#f0f7ff',
            borderRadius: 8,
            padding: 16,
            marginTop: 15,
            marginBottom: 15,
            marginHorizontal: 15,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: '#2c3e50',
              marginBottom: 20,
            }}>Résumé global du projet</Text>
            
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 10,
            }}>
              <Text style={{
                fontSize: 17,
                color: '#333',
                flex: 1,
              }}>Superficie totale:</Text>
              <Text style={{
                fontSize: 26,
                fontWeight: 'bold',
                color: '#3b82f6',
              }}>{submission.superficieTotaleGlobale} pi²</Text>
            </View>
            
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 10,
            }}>
              <Text style={{
                fontSize: 17,
                color: '#333',
                flex: 1,
              }}>Nombre de sections:</Text>
              <Text style={{
                fontSize: 18,
                fontWeight: '500',
                color: '#333',
              }}>{submission.sections.length}</Text>
            </View>
            
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 10,
            }}>
              <Text style={{
                fontSize: 17,
                color: '#333',
                flex: 1,
              }}>Total de photos:</Text>
              <Text style={{
                fontSize: 18,
                fontWeight: '500',
                color: '#333',
              }}>{submission.totalPhotos || 0}</Text>
            </View>
            
            {/* Matériaux totaux */}
            <View style={{
              marginTop: 16,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: '#e5e7eb',
            }}>
              <Text style={{
                fontSize: 17,
                fontWeight: '500',
                color: '#333',
                marginBottom: 12,
              }}>Matériaux à charger (total):</Text>
              
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                {(() => {
                  // Calculer les matériaux pour la superficie totale
                  const superficieTotale = submission.superficieTotaleGlobale || 0;
                  const materials = {
                    fastNStick: Math.ceil((superficieTotale / 140) * 1.1),
                    armourCool: Math.ceil((superficieTotale / 78) * 1.1),
                    securePan: Math.ceil((superficieTotale / 32) * 1.1),
                    armourBond: Math.ceil((superficieTotale / 98) * 1.15),
                    tp180ff: Math.ceil(superficieTotale / 1500)
                  };
                  
                  return (
                    <>
                      <View style={{
                        backgroundColor: 'white',
                        padding: 10,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                        alignItems: 'center',
                        minWidth: 60,
                        flex: 1,
                      }}>
                        <Text style={{
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: '#d4a574',
                        }}>{materials.fastNStick}</Text>
                        <Text style={{
                          fontSize: 10,
                          color: '#666',
                          marginTop: 2,
                          textAlign: 'center',
                        }}>Fast-N-Stick</Text>
                      </View>
                      
                      <View style={{
                        backgroundColor: 'white',
                        padding: 10,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                        alignItems: 'center',
                        minWidth: 60,
                        flex: 1,
                      }}>
                        <Text style={{
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: '#d4a574',
                        }}>{materials.armourCool}</Text>
                        <Text style={{
                          fontSize: 10,
                          color: '#666',
                          marginTop: 2,
                          textAlign: 'center',
                        }}>ArmourCool</Text>
                      </View>
                      
                      <View style={{
                        backgroundColor: 'white',
                        padding: 10,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                        alignItems: 'center',
                        minWidth: 60,
                        flex: 1,
                      }}>
                        <Text style={{
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: '#d4a574',
                        }}>{materials.securePan}</Text>
                        <Text style={{
                          fontSize: 10,
                          color: '#666',
                          marginTop: 2,
                          textAlign: 'center',
                        }}>SecurePan</Text>
                      </View>
                      
                      <View style={{
                        backgroundColor: 'white',
                        padding: 10,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                        alignItems: 'center',
                        minWidth: 60,
                        flex: 1,
                      }}>
                        <Text style={{
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: '#d4a574',
                        }}>{materials.armourBond}</Text>
                        <Text style={{
                          fontSize: 10,
                          color: '#666',
                          marginTop: 2,
                          textAlign: 'center',
                        }}>ArmourBond</Text>
                      </View>
                      
                      <View style={{
                        backgroundColor: 'white',
                        padding: 10,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                        alignItems: 'center',
                        minWidth: 60,
                        flex: 1,
                      }}>
                        <Text style={{
                          fontSize: 20,
                          fontWeight: 'bold',
                          color: '#d4a574',
                        }}>{materials.tp180ff}</Text>
                        <Text style={{
                          fontSize: 10,
                          color: '#666',
                          marginTop: 2,
                          textAlign: 'center',
                        }}>TP-180-FF</Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>
            
            {submission.sections && submission.sections.length > 0 && (
              <View style={{
                marginTop: 16,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb',
              }}>
                <Text style={{
                  fontSize: 17,
                  fontWeight: '500',
                  color: '#333',
                  marginBottom: 12,
                }}>Détail par section:</Text>
                {submission.sections.map((section, index) => (
                  <View key={index} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                  }}>
                    <Text style={{
                      fontSize: 16,
                      color: '#555',
                      flex: 1,
                    }}>
                      • {section.sectionName || `Section ${index + 1}`}:
                    </Text>
                    <Text style={{
                      fontSize: 17,
                      fontWeight: '500',
                      color: '#333',
                    }}>
                      {typeof section.superficie === 'object' 
                        ? (section.superficie.totale || 0) 
                        : (section.superficie || 0)} pi²
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal pour affichage plein écran des photos */}
      <Modal 
        visible={selectedPhotoIndex !== null} 
        transparent={true}
        animationType="fade"
      >
        <View style={styles.photoModal}>
          <TouchableOpacity 
            style={styles.closeModal} 
            onPress={() => setSelectedPhotoIndex(null)}
          >
            <FontAwesome5 name="times" size={30} color="white" />
          </TouchableOpacity>
          
          {selectedPhotoIndex !== null && displayData.photos && (
            <>
              <Text style={styles.photoCounter}>
                {selectedPhotoIndex + 1} / {displayData.photos.length}
              </Text>
              
              <TouchableOpacity 
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={() => navigatePhoto('prev')}
              >
                <FontAwesome5 name="chevron-left" size={30} color="white" />
              </TouchableOpacity>
              
              <Image 
                source={{ uri: getPhotoUrl(displayData.photos[selectedPhotoIndex]) }} 
                style={styles.fullPhoto}
                resizeMode="contain"
              />
              
              <TouchableOpacity 
                style={[styles.navButton, styles.navButtonRight]}
                onPress={() => navigatePhoto('next')}
              >
                <FontAwesome5 name="chevron-right" size={30} color="white" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 15,
    paddingBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  clientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  clientInfo: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginTop: 5,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#3498db',
    textDecorationLine: 'underline',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  dimensionText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  superficieText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3498db',
  },
  totalItems: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  puitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 5,
  },
  puitName: {
    fontSize: 14,
    color: '#333',
  },
  puitDimensions: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  materialsSection: {
    backgroundColor: '#fffbf0',
    borderWidth: 2,
    borderColor: '#f0e6d2',
  },
  materialDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  materialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  calculatedItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    minWidth: 60,
    flex: 1,
  },
  calculatedNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#d4a574',
  },
  calculatedLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  materialNote: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  optionText: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 5,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notesDisplay: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  notesActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#7f8c8d',
    fontSize: 14,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumbnail: {
    width: (width - 60) / 3,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  photoNumber: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  photoPlaceholderSubtext: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  photoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModal: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  photoCounter: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    padding: 15,
    zIndex: 10,
  },
  navButtonLeft: {
    left: 10,
  },
  navButtonRight: {
    right: 10,
  },
  fullPhoto: {
    width: width,
    height: height * 0.8,
  },
  // Styles pour sections multiples
  sectionTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 100,
    alignItems: 'center',
  },
  activeSectionTab: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  sectionTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeSectionTabText: {
    color: 'white',
  },
  sectionTabSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  activeSectionTabSubtext: {
    color: 'rgba(255,255,255,0.8)',
  },
  currentSectionHeader: {
    backgroundColor: '#e8f4f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentSectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  currentSectionInfo: {
    fontSize: 12,
    color: '#666',
  },
});

export default SubmissionViewer;