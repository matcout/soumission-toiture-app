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

  // Navigate photos
  const navigatePhoto = (direction) => {
    if (!submission.photos || submission.photos.length === 0) return;
    
    if (direction === 'prev') {
      setSelectedPhotoIndex(prev => 
        prev > 0 ? prev - 1 : submission.photos.length - 1
      );
    } else {
      setSelectedPhotoIndex(prev => 
        prev < submission.photos.length - 1 ? prev + 1 : 0
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
    return submission.toiture?.superficie?.totale || 0;
  };

  // Calculer les quantités de matériaux
  const calculateMaterialQuantities = () => {
    const superficie = submission.toiture?.superficie?.toiture || 0;
    const parapets = submission.toiture?.superficie?.parapets || 0;
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
  const hasPuitsLumiere = submission.toiture?.puitsLumiere && 
    submission.toiture.puitsLumiere.length > 0 && 
    submission.toiture.puitsLumiere.some(puit => puit.length > 0 || puit.width > 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="white" />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>
          {formatDate(submission.createdAt || submission.date)}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Adresse principale */}
        <View style={styles.addressSection}>
          <Text style={styles.mainAddress}>
            {submission.client?.adresse || submission.displayName || 'Adresse inconnue'}
          </Text>
          {submission.client?.adresse && (
            <TouchableOpacity 
              style={styles.mapsButton}
              onPress={() => openGoogleMaps(submission.client.adresse)}
            >
              <FontAwesome5 name="map-marker-alt" size={16} color="white" />
              <Text style={styles.mapsButtonText}>Google Maps</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Informations client et superficie */}
        <View style={styles.infoGrid}>
          {/* Client */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Client</Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Nom:</Text> {submission.client?.nom || 'Non spécifié'}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Tél:</Text> {submission.client?.telephone || 'Non spécifié'}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Courriel:</Text> {submission.client?.courriel || 'Non spécifié'}
            </Text>
          </View>

          {/* Superficie */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Superficie</Text>
            <Text style={styles.bigNumber}>{getSuperficieTotale().toFixed(2)} pi²</Text>
            {submission.toiture?.superficie && (
              <View>
                <Text style={styles.infoText}>Toiture: {(submission.toiture.superficie.toiture || 0).toFixed(2)} pi²</Text>
                <Text style={styles.infoText}>Parapets: {(submission.toiture.superficie.parapets || 0).toFixed(2)} pi²</Text>
              </View>
            )}
          </View>
        </View>

        {/* Puits de lumière si présents */}
        {hasPuitsLumiere && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Puits de lumière</Text>
            {submission.toiture.puitsLumiere.map((puit, index) => (
              <View key={index} style={styles.puitItem}>
                <Text style={styles.puitName}>{puit.name || `Puit ${index + 1}`}</Text>
                <Text style={styles.puitDimensions}>{puit.length}" × {puit.width}"</Text>
              </View>
            ))}
          </View>
        )}

        {/* Matériaux */}
        {submission.materiaux && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Matériaux</Text>
            <View style={styles.materialGrid}>
              {submission.materiaux.nbFeuilles > 0 && (
                <View style={styles.materialItem}>
                  <Text style={styles.materialNumber}>{submission.materiaux.nbFeuilles}</Text>
                  <Text style={styles.materialLabel}>Feuilles</Text>
                </View>
              )}
              {submission.materiaux.nbMax > 0 && (
                <View style={styles.materialItem}>
                  <Text style={styles.materialNumber}>{submission.materiaux.nbMax}</Text>
                  <Text style={styles.materialLabel}>Maximum</Text>
                </View>
              )}
              {submission.materiaux.nbEvents > 0 && (
                <View style={styles.materialItem}>
                  <Text style={styles.materialNumber}>{submission.materiaux.nbEvents}</Text>
                  <Text style={styles.materialLabel}>Évents</Text>
                </View>
              )}
              {submission.materiaux.nbDrains > 0 && (
                <View style={styles.materialItem}>
                  <Text style={styles.materialNumber}>{submission.materiaux.nbDrains}</Text>
                  <Text style={styles.materialLabel}>Drains</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Quantités calculées */}
        {(submission.toiture?.superficie?.toiture > 0 || submission.toiture?.superficie?.parapets > 0) && (
          <View style={[styles.section, styles.yellowSection]}>
            <Text style={styles.sectionTitle}>📦 Matériaux à charger</Text>
            <Text style={styles.totalItems}>
              Total: {materialQuantities.fastNStick + materialQuantities.armourCool + 
                     materialQuantities.securePan + materialQuantities.armourBond + 
                     materialQuantities.tp180ff} items
            </Text>
            <View style={styles.materialGrid}>
              <View style={styles.calculatedItem}>
                <Text style={styles.calculatedNumber}>{materialQuantities.fastNStick}</Text>
                <Text style={styles.calculatedLabel}>Fast-N-Stick</Text>
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
            
            {/* Indicateurs importants */}
            {(submission.options?.grue || submission.options?.hydroQuebec) && (
              <View style={styles.warningContainer}>
                {submission.options?.grue && (
                  <View style={styles.warningBadge}>
                    <Text style={styles.warningText}>⚠️ GRUE NÉCESSAIRE</Text>
                  </View>
                )}
                {submission.options?.hydroQuebec && (
                  <View style={styles.warningBadgeDanger}>
                    <Text style={styles.warningTextDanger}>⚠️ HYDRO-QUÉBEC</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Options */}
        {submission.options && (submission.options.plusieursEpaisseurs || 
          submission.options.hydroQuebec || 
          submission.options.grue || 
          submission.options.trackfall) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Options</Text>
            {submission.options.plusieursEpaisseurs && (
              <Text style={styles.optionText}>✓ Plusieurs épaisseurs de toiture</Text>
            )}
            {submission.options.hydroQuebec && (
              <Text style={styles.optionText}>✓ Travaux Hydro Québec requis</Text>
            )}
            {submission.options.grue && (
              <Text style={styles.optionText}>✓ Grue nécessaire</Text>
            )}
            {submission.options.trackfall && (
              <Text style={styles.optionText}>✓ Trackfall et chute</Text>
            )}
          </View>
        )}

        {/* Notes avec édition */}
        <View style={styles.section}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {!isEditingNotes && (
              <TouchableOpacity onPress={() => setIsEditingNotes(true)}>
                <FontAwesome5 name="edit" size={18} color="#3498db" />
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
                numberOfLines={4}
                placeholder="Ajoutez vos notes ici..."
                editable={!isSaving}
              />
              <View style={styles.notesActions}>
                <TouchableOpacity 
                  style={[styles.saveButton, isSaving && styles.disabledButton]}
                  onPress={handleSaveNotes}
                  disabled={isSaving}
                >
                  <FontAwesome5 name="save" size={16} color="white" />
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

        {/* Photos */}
        {submission.photos && submission.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({submission.photos.length})</Text>
            <View style={styles.photoGrid}>
              {submission.photos.map((photo, index) => {
                const photoUrl = typeof photo === 'string' ? photo : photo.uri || photo.url;
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
                    />
                    <Text style={styles.photoNumber}>Photo {index + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Photo viewer modal */}
      {selectedPhotoIndex !== null && submission.photos && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedPhotoIndex(null)}
        >
          <View style={styles.photoModal}>
            <TouchableOpacity 
              style={styles.closeModal}
              onPress={() => setSelectedPhotoIndex(null)}
            >
              <FontAwesome5 name="times" size={24} color="white" />
            </TouchableOpacity>

            <Text style={styles.photoCounter}>
              {selectedPhotoIndex + 1} / {submission.photos.length}
            </Text>

            <TouchableOpacity
              style={[styles.navButton, styles.navButtonLeft]}
              onPress={() => navigatePhoto('prev')}
            >
              <FontAwesome5 name="chevron-left" size={30} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, styles.navButtonRight]}
              onPress={() => navigatePhoto('next')}
            >
              <FontAwesome5 name="chevron-right" size={30} color="white" />
            </TouchableOpacity>

            <Image
              source={{ uri: submission.photos[selectedPhotoIndex].uri || submission.photos[selectedPhotoIndex] }}
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#2c3e50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 10,
  },
  dateText: {
    color: 'white',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  addressSection: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  mainAddress: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  mapsButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapsButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
  },
  infoGrid: {
    flexDirection: 'row',
    padding: 15,
    gap: 15,
  },
  infoCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  bold: {
    fontWeight: 'bold',
  },
  bigNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 5,
  },
  section: {
    backgroundColor: 'white',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  yellowSection: {
    backgroundColor: '#fffbf0',
    borderWidth: 2,
    borderColor: '#f39c12',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
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
  materialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  materialItem: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  materialNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  materialLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  totalItems: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 10,
    textAlign: 'right',
  },
  calculatedItem: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f39c12',
    alignItems: 'center',
    minWidth: 60,
  },
  calculatedNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f39c12',
  },
  calculatedLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    justifyContent: 'center',
  },
  warningBadge: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  warningBadgeDanger: {
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  warningText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  warningTextDanger: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
    backgroundColor: '#27ae60',
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
});

export default SubmissionViewer;