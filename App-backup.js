import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const App = () => {
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    courriel: '',
    longueur: '',
    largeur: '',
    notes: ''
  });

  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [notification, setNotification] = useState({ visible: false, message: '', type: '' });
  const [activeSection, setActiveSection] = useState(null);

  const superficie = () => {
    const l = parseFloat(formData.longueur) || 0;
    const w = parseFloat(formData.largeur) || 0;
    return (l * w).toFixed(2);
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      adresse: '',
      telephone: '',
      courriel: '',
      longueur: '',
      largeur: '',
      notes: ''
    });
    setPhotos([]);
    showNotification('Formulaire réinitialisé', 'success');
  };

  const enregistrerSoumission = () => {
    if (!formData.adresse.trim()) {
      showNotification('Adresse des travaux requise', 'error');
      return;
    }

    Alert.alert(
      'Soumission enregistrée',
      `Projet: ${formData.adresse}\nSuperficie: ${superficie()} pieds²\nPhotos: ${photos.length}`,
      [{ text: 'OK' }]
    );
    showNotification('Soumission enregistrée avec succès', 'success');
  };

  const showNotification = (message, type) => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification({ visible: false, message: '', type: '' }), 3000);
  };

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const deletePhoto = (id) => {
    setPhotos(photos.filter(photo => photo.id !== id));
  };

  const takePhoto = async () => {
    try {
      console.log('🔥 Début prise de photo...');
      
      // Demander permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📱 Permission:', permissionResult.status);
      
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission refusée', 'La caméra est nécessaire pour prendre des photos');
        return;
      }

      console.log('📸 Lancement caméra...');
      
      // Prendre une photo avec options simplifiées
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
        aspect: [4, 3],
      });
      
      console.log('📷 Résultat caméra:', result);
      
      if (!result.canceled && result.assets && result.assets[0]) {
        const newPhoto = { 
          id: Date.now().toString(), 
          uri: result.assets[0].uri 
        };
        console.log('✅ Photo ajoutée:', newPhoto.id);
        setPhotos(prevPhotos => [...prevPhotos, newPhoto]);
        showNotification('Photo ajoutée avec succès', 'success');
      } else {
        console.log('❌ Photo annulée ou erreur');
      }
    } catch (error) {
      console.error('🚨 Erreur caméra:', error);
      Alert.alert('Erreur', 'Impossible de prendre une photo: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Soumission Toiture</Text>
        <Text style={styles.subtitle}>Version simplifiée - Test caméra</Text>
      </View>

      <ScrollView style={styles.scrollContainer}>
        {/* Section Informations client */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('client')}>
          <FontAwesome5 name="user" size={20} color="white" />
          <Text style={styles.sectionTitle}>Informations client</Text>
          <FontAwesome5 name={activeSection === 'client' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'client' && (
          <View style={styles.sectionContent}>
            <Text style={styles.label}>Nom du client</Text>
            <TextInput
              style={styles.input}
              value={formData.nom}
              onChangeText={text => setFormData({...formData, nom: text})}
              placeholder="Nom complet"
            />
            
            <Text style={styles.label}>Adresse des travaux</Text>
            <TextInput
              style={styles.input}
              value={formData.adresse}
              onChangeText={text => setFormData({...formData, adresse: text})}
              placeholder="Adresse complète"
            />
            
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              value={formData.telephone}
              onChangeText={text => setFormData({...formData, telephone: text})}
              placeholder="(123) 456-7890"
              keyboardType="phone-pad"
            />
            
            <Text style={styles.label}>Courriel</Text>
            <TextInput
              style={styles.input}
              value={formData.courriel}
              onChangeText={text => setFormData({...formData, courriel: text})}
              placeholder="email@exemple.com"
              keyboardType="email-address"
            />
          </View>
        )}

        {/* Section Dimensions simplifiée */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('dimensions')}>
          <FontAwesome5 name="ruler-combined" size={20} color="white" />
          <Text style={styles.sectionTitle}>Dimensions de la toiture</Text>
          <FontAwesome5 name={activeSection === 'dimensions' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'dimensions' && (
          <View style={styles.sectionContent}>
            <View style={styles.dimensionRow}>
              <View style={styles.dimensionItem}>
                <Text style={styles.label}>Longueur (pieds)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.longueur}
                  onChangeText={text => setFormData({...formData, longueur: text})}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              
              <Text style={styles.multiply}>×</Text>
              
              <View style={styles.dimensionItem}>
                <Text style={styles.label}>Largeur (pieds)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.largeur}
                  onChangeText={text => setFormData({...formData, largeur: text})}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Superficie totale:</Text>
              <Text style={styles.totalValue}>{superficie()} pi²</Text>
            </View>
          </View>
        )}

        {/* Section Photos */}
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('photos')}
        >
          <FontAwesome5 name="camera" size={20} color="white" />
          <Text style={styles.sectionTitle}>Photos du projet ({photos.length})</Text>
          <FontAwesome5 name={activeSection === 'photos' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'photos' && (
          <View style={styles.sectionContent}>
            <Text style={styles.photoNote}>
              Testez la caméra native sans "Use/Retake" !
            </Text>
            
            <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
              <FontAwesome5 name="camera" size={24} color="white" />
              <Text style={styles.cameraButtonText}>Prendre une photo</Text>
            </TouchableOpacity>
            
            <View style={styles.photosContainer}>
              {photos.map(photo => (
                <View key={photo.id} style={styles.photoItem}>
                  <TouchableOpacity onPress={() => setSelectedPhoto(photo)}>
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deletePhoto(photo.id)}
                  >
                    <FontAwesome5 name="trash" size={12} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            
            {photos.length > 0 && (
              <Text style={styles.photoCount}>
                ✅ {photos.length} photo(s) prise(s) avec succès !
              </Text>
            )}
          </View>
        )}

        {/* Section Notes */}
        <TouchableOpacity 
          style={styles.sectionHeader} 
          onPress={() => toggleSection('notes')}
        >
          <FontAwesome5 name="sticky-note" size={20} color="white" />
          <Text style={styles.sectionTitle}>Notes supplémentaires</Text>
          <FontAwesome5 name={activeSection === 'notes' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'notes' && (
          <View style={styles.sectionContent}>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              value={formData.notes}
              onChangeText={text => setFormData({...formData, notes: text})}
              placeholder="Décrivez ici toute information supplémentaire importante..."
            />
          </View>
        )}

        {/* Boutons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={enregistrerSoumission}>
            <FontAwesome5 name="save" size={18} color="white" />
            <Text style={styles.buttonText}>Enregistrer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.resetButton} onPress={resetForm}>
            <FontAwesome5 name="redo" size={18} color="#2c3e50" />
            <Text style={styles.resetButtonText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal pour afficher la photo sélectionnée */}
      {selectedPhoto && (
        <Modal visible={!!selectedPhoto} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setSelectedPhoto(null)}
            >
              <FontAwesome5 name="times" size={30} color="white" />
            </TouchableOpacity>
            <View style={styles.modalContainer}>
              <Image source={{ uri: selectedPhoto.uri }} style={styles.modalImage} />
              <Text style={styles.photoInfo}>Photo du projet</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Notification */}
      {notification.visible && (
        <View style={[
          styles.notification, 
          notification.type === 'success' ? styles.successNotification : styles.errorNotification
        ]}>
          <FontAwesome5 
            name={notification.type === 'success' ? "check-circle" : "exclamation-circle"} 
            size={20} 
            color="white" 
          />
          <Text style={styles.notificationText}>{notification.message}</Text>
        </View>
      )}

      <StatusBar style="light" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#2c3e50',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  title: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  scrollContainer: {
    flex: 1,
    paddingBottom: 20,
  },
  sectionHeader: {
    backgroundColor: '#3498db',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 10,
    marginTop: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  sectionContent: {
    backgroundColor: 'white',
    padding: 15,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  label: {
    marginBottom: 5,
    fontWeight: '500',
    color: '#2c3e50',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: 'white',
    fontSize: 15,
  },
  dimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dimensionItem: {
    flex: 1,
  },
  multiply: {
    fontWeight: 'bold',
    color: '#3498db',
    fontSize: 18,
    marginHorizontal: 15,
    marginTop: 20,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#3498db',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
  },
  cameraButton: {
    backgroundColor: '#27ae60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  cameraButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  photoItem: {
    width: (width - 80) / 3,
    height: (width - 80) / 3,
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    padding: 5,
    borderRadius: 15,
  },
  photoCount: {
    marginTop: 10,
    textAlign: 'center',
    color: '#27ae60',
    fontWeight: '600',
  },
  photoNote: {
    color: '#7f8c8d',
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    padding: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 10,
    marginTop: 20,
    marginBottom: 30,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resetButton: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  resetButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    height: '80%',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 10,
  },
  photoInfo: {
    color: 'white',
    textAlign: 'center',
    marginTop: 15,
  },
  notification: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successNotification: {
    backgroundColor: '#27ae60',
  },
  errorNotification: {
    backgroundColor: '#e74c3c',
  },
  notificationText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 10,
  },
});

export default App;