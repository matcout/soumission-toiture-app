import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { Camera, useCameraDevices, useCameraPermission } from 'react-native-vision-camera';
import { FontAwesome5 } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const CustomCamera = ({ visible, onClose, onPhotoTaken }) => {
  const camera = useRef(null);
  const devices = useCameraDevices();
  const device = devices.back || devices.find(d => d.position === 'back');
  const { hasPermission, requestPermission } = useCameraPermission();
  
  const [isActive, setIsActive] = useState(false);
  const [flash, setFlash] = useState('off');
  const [photoCount, setPhotoCount] = useState(0);
  const [lastPhotoFeedback, setLastPhotoFeedback] = useState(false);
  const [flashAnimation, setFlashAnimation] = useState(false);
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const [sessionPhotos, setSessionPhotos] = useState([]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      setIsActive(true);
      setPhotoCount(0);
      setSessionPhotos([]);
      if (!hasPermission) {
        requestPermission();
      }
    } else {
      setIsActive(false);
    }
  }, [visible, hasPermission]);

  const { width, height } = screenData;
  const isLandscape = width > height;



// 🔧 OPTIMISATION: Compression photos dans CustomCamera.js
// Modifier la fonction takePhoto pour des photos plus légères

const takePhoto = async () => {
  try {
    if (camera.current == null) {
      Alert.alert('Erreur', 'Caméra non disponible');
      return;
    }

    setFlashAnimation(true);
    setTimeout(() => setFlashAnimation(false), 150);
    setLastPhotoFeedback(true);
    setTimeout(() => setLastPhotoFeedback(false), 800);

    // ✅ CONFIGURATION OPTIMALE QUALITÉ/PERFORMANCE
    const photo = await camera.current.takePhoto({
      quality: 0.85,           // ✅ Excellente qualité
      flash: flash,
      enableAutoRedEyeReduction: true,
      format: 'jpeg',
      enableShutterSound: false,
      skipMetadata: false,
      // ✅ Ajouts pour iPhone
      enablePortraitEffectsMatteDelivery: false,
      enableDepthData: false,
      qualityPrioritization: 'quality', // Prioriser la qualité
    });

    const fileInfo = await FileSystem.getInfoAsync(photo.path);
    const fileSizeMB = fileInfo.size / 1024 / 1024;
    
    console.log(`📸 Photo capturée: ${fileSizeMB.toFixed(2)}MB (qualité 0.6)`);
    
    // ✅ Avertissement seulement si > 10MB
    if (fileSizeMB > 8) {
      console.warn(`⚠️ Photo très lourde: ${fileSizeMB.toFixed(2)}MB`);
    }

    const newPhoto = {
      id: Date.now().toString(),
      uri: Platform.OS === 'ios' ? `file://${photo.path}` : photo.path,
      size: fileInfo.size,
      timestamp: new Date().toISOString(),
      quality: 0.6 // ✅ Tracer la qualité
    };

    setSessionPhotos(prev => [...prev, newPhoto]);
    setPhotoCount(prev => prev + 1);
    onPhotoTaken(newPhoto);

  } catch (error) {
    console.error('Erreur lors de la prise de photo:', error);
    Alert.alert('Erreur', 'Impossible de prendre la photo');
  }
};

  const finishAndClose = () => {
    onClose();
  };

  if (!hasPermission) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Permission caméra requise</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Autoriser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  if (device == null) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Caméra non disponible</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              setIsActive(false);
              setTimeout(() => setIsActive(true), 500);
            }}
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Caméra plein écran */}
        <Camera
          ref={camera}
          style={styles.camera}
          device={device}
          isActive={isActive && visible}
          photo={true}
          enableZoomGesture={true}
          resizeMode="cover"
        />
        
        {/* Animation Flash */}
        {flashAnimation && <View style={styles.flashOverlay} />}
        
        {/* Feedback photo prise */}
        {lastPhotoFeedback && (
          <View style={styles.photoFeedback}>
            <View style={styles.feedbackIcon}>
              <FontAwesome5 name="check-circle" size={30} color="#27ae60" />
            </View>
            <Text style={styles.photoFeedbackText}>Photo capturée !</Text>
          </View>
        )}
        
        {/* Bouton fermer (haut gauche) */}
        <TouchableOpacity style={styles.closeButtonTop} onPress={finishAndClose}>
          <View style={styles.closeButtonCircle}>
            <FontAwesome5 name="times" size={20} color="white" />
          </View>
        </TouchableOpacity>

        {/* Galerie miniatures (bas gauche) */}
        {sessionPhotos.length > 0 && (
          <View style={styles.galleryContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryContent}
            >
              {sessionPhotos.slice(-6).map((photo, index) => (
                <View key={photo.id} style={styles.miniatureWrapper}>
                  <Image source={{ uri: photo.uri }} style={styles.miniatureImage} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Interface du bas - Style iOS natif */}
        <View style={styles.bottomInterface}>
          {/* Mode PHOTO centré */}
          <View style={styles.modeContainer}>
            <Text style={styles.modeText}>PHOTO</Text>
          </View>

          {/* Contrôles du bas */}
          <View style={styles.bottomControls}>
            {/* Bouton Annuler */}
            <TouchableOpacity style={styles.cancelButton} onPress={finishAndClose}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>

            {/* Bouton capture central */}
            <TouchableOpacity style={styles.captureButtonNative} onPress={takePhoto}>
              <View style={styles.captureButtonInnerNative} />
            </TouchableOpacity>

            {/* Bouton Enregistrer */}
            <TouchableOpacity 
              style={[styles.saveButton, { opacity: sessionPhotos.length > 0 ? 1 : 0.3 }]} 
              onPress={sessionPhotos.length > 0 ? finishAndClose : null}
              disabled={sessionPhotos.length === 0}
            >
              <Text style={styles.saveText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>

          {/* Barre de progression du bas */}
          <View style={styles.progressBar} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  
  // Bouton fermer (haut gauche)
  closeButtonTop: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    zIndex: 100,
  },
  closeButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Flash overlay
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    zIndex: 5,
  },

  // Feedback photo
  photoFeedback: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  feedbackIcon: {
    marginBottom: 10,
  },
  photoFeedbackText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },

  // Galerie miniatures
  galleryContainer: {
    position: 'absolute',
    bottom: 200,
    left: 20,
    zIndex: 10,
    maxWidth: 350, // Augmenté pour 6 miniatures
  },
  galleryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniatureWrapper: {
    marginRight: 8,
  },
  miniatureImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },

  // Interface du bas - Style iOS natif
  bottomInterface: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'black',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },

  // Mode PHOTO
  modeContainer: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  modeText: {
    color: '#00FF00', // Vert comme dans l'image
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
  },

  // Contrôles du bas
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },

  // Bouton Annuler (gauche)
  cancelButton: {
    minWidth: 80,
  },
  cancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '400',
  },

  // Bouton capture central - Style iOS natif
  captureButtonNative: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInnerNative: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },

  // Bouton Enregistrer (droite)
  saveButton: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  saveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '400',
  },

  // Barre de progression du bas
  progressBar: {
    height: 4,
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 2,
  },

  // Styles pour erreurs et permissions
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    padding: 20,
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomCamera;