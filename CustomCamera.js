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
} from 'react-native';
import { Camera, useCameraDevices, useCameraPermission } from 'react-native-vision-camera';
import { FontAwesome5 } from '@expo/vector-icons';

// ⭐ DIMENSIONS DYNAMIQUES pour rotation (compatible Expo Go)
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
  const [lastPhotoUri, setLastPhotoUri] = useState(null);
  const [showMiniature, setShowMiniature] = useState(false);
  const [screenData, setScreenData] = useState(Dimensions.get('window'));

  // ⭐ NOUVEAU: Écouter les changements d'orientation (compatible Expo Go)
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
      if (!hasPermission) {
        requestPermission();
      }
    } else {
      setIsActive(false);
    }
  }, [visible, hasPermission]);

  // ⭐ NOUVEAU: Dimensions dynamiques selon orientation
  const { width, height } = screenData;
  const isLandscape = width > height;

  const takePhoto = async () => {
    try {
      if (camera.current == null) {
        Alert.alert('Erreur', 'Caméra non disponible');
        return;
      }

      // 1. Animation flash blanc instantané (style iPhone)
      setFlashAnimation(true);
      setTimeout(() => setFlashAnimation(false), 150);

      // 2. Feedback visuel rapide
      setLastPhotoFeedback(true);
      setTimeout(() => setLastPhotoFeedback(false), 800);

      // Prendre la photo INSTANTANÉMENT avec format optimisé
      const photo = await camera.current.takePhoto({
        quality: 0.8,
        flash: flash,
        enableAutoRedEyeReduction: true,
        // ⭐ NOUVEAU: Format optimisé selon orientation
        format: 'jpeg',
      });

      // Photo prise avec succès
      const newPhoto = {
        id: Date.now().toString(),
        uri: Platform.OS === 'ios' ? `file://${photo.path}` : photo.path,
      };

      // 3. Sauvegarder pour miniature
      setLastPhotoUri(newPhoto.uri);
      
      // 4. Animation miniature (apparition avec effet)
      setShowMiniature(true);
      setTimeout(() => setShowMiniature(false), 1000);

      // Incrémenter le compteur
      setPhotoCount(prev => prev + 1);

      // Envoyer la photo SANS fermer la caméra
      onPhotoTaken(newPhoto);

    } catch (error) {
      console.error('Erreur lors de la prise de photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo');
    }
  };

  const toggleFlash = () => {
    setFlash(current => current === 'off' ? 'on' : 'off');
  };

  const finishAndClose = () => {
    onClose();
  };

  if (!hasPermission) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            Permission caméra requise
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Autoriser</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
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
      <View style={[styles.container, { width, height }]}>
        <Camera
          ref={camera}
          style={[styles.camera, { width, height }]}
          device={device}
          isActive={isActive && visible}
          photo={true}
          enableZoomGesture={true}
          // ⭐ NOUVEAU: Utiliser toute la surface disponible
          resizeMode="cover"
        />
        
        {/* Animation Flash Blanc (style iPhone) */}
        {flashAnimation && (
          <View style={[styles.flashOverlay, { width, height }]} />
        )}
        
        {/* Feedback visuel pour photo prise */}
        {lastPhotoFeedback && (
          <View style={[styles.photoFeedback, isLandscape && styles.photoFeedbackLandscape]}>
            <View style={styles.feedbackIcon}>
              <FontAwesome5 name="check-circle" size={30} color="#27ae60" />
            </View>
            <Text style={styles.photoFeedbackText}>Photo capturée !</Text>
          </View>
        )}
        
        {/* Miniature de la dernière photo avec animation */}
        {showMiniature && lastPhotoUri && (
          <View style={[styles.miniatureContainer, isLandscape && styles.miniatureContainerLandscape]}>
            <View style={[styles.miniature, showMiniature && styles.miniatureVisible]}>
              <Image source={{ uri: lastPhotoUri }} style={styles.miniatureImage} />
              <View style={styles.miniatureOverlay}>
                <FontAwesome5 name="plus" size={16} color="white" />
              </View>
            </View>
          </View>
        )}
        
        {/* Overlay avec contrôles adaptés à l'orientation */}
        <View style={[styles.overlay, { width, height }]}>
          {/* Header avec bouton fermer, compteur et flash */}
          <View style={[styles.header, isLandscape && styles.headerLandscape]}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={finishAndClose}
            >
              <FontAwesome5 name="times" size={24} color="white" />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <Text style={styles.title}>
                Photos Projet {isLandscape && '🔄 (Mode Large)'}
              </Text>
              {photoCount > 0 && (
                <Text style={styles.photoCounter}>{photoCount} photo{photoCount > 1 ? 's' : ''} prise{photoCount > 1 ? 's' : ''}</Text>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={toggleFlash}
            >
              <FontAwesome5 
                name={flash === 'on' ? 'bolt' : 'bolt'} 
                size={24} 
                color={flash === 'on' ? '#f39c12' : 'white'} 
              />
            </TouchableOpacity>
          </View>

          {/* Instructions adaptées */}
          <View style={[styles.instructionsContainer, isLandscape && styles.instructionsLandscape]}>
            <Text style={styles.instructions}>
              {photoCount === 0 
                ? (isLandscape ? "🔄 Mode paysage détecté - champ plus large ! Capturez la toiture" : "Visez la toiture et appuyez pour capturer")
                : "Continuez à prendre des photos ou fermez quand terminé"
              }
            </Text>
          </View>

          {/* Footer avec boutons adaptés */}
          <View style={[styles.footer, isLandscape && styles.footerLandscape]}>
            <View style={[styles.buttonRow, isLandscape && styles.buttonRowLandscape]}>
              {/* Bouton Terminé (si photos prises) */}
              {photoCount > 0 && (
                <TouchableOpacity 
                  style={styles.doneButton}
                  onPress={finishAndClose}
                >
                  <FontAwesome5 name="check" size={20} color="white" />
                  <Text style={styles.doneButtonText}>Terminé</Text>
                </TouchableOpacity>
              )}
              
              {/* Bouton de capture principal */}
              <TouchableOpacity 
                style={styles.captureButton}
                onPress={takePhoto}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
              
              {/* Espace pour symétrie */}
              {photoCount > 0 && <View style={styles.spacer} />}
            </View>
            
            <Text style={styles.captureText}>
              📸 Capture continue {isLandscape ? '📱 (Horizontal)' : '📱 (Vertical)'}
            </Text>
          </View>
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  // ⭐ NOUVEAU: Styles pour mode paysage
  headerLandscape: {
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 40,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  photoCounter: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  instructionsContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 15,
    marginHorizontal: 20,
    borderRadius: 10,
  },
  // ⭐ NOUVEAU: Instructions en mode paysage
  instructionsLandscape: {
    marginHorizontal: 60,
    paddingVertical: 10,
  },
  instructions: {
    color: 'white',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingTop: 20,
  },
  // ⭐ NOUVEAU: Footer en mode paysage
  footerLandscape: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 15,
    paddingHorizontal: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    width: '100%',
  },
  // ⭐ NOUVEAU: Boutons en mode paysage
  buttonRowLandscape: {
    marginBottom: 10,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#3498db',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3498db',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27ae60',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    position: 'absolute',
    left: 20,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  spacer: {
    width: 100,
  },
  captureText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  photoFeedback: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  // ⭐ NOUVEAU: Feedback en mode paysage
  photoFeedbackLandscape: {
    top: '40%',
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
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    zIndex: 5,
  },
  miniatureContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    zIndex: 10,
  },
  // ⭐ NOUVEAU: Miniature en mode paysage
  miniatureContainerLandscape: {
    bottom: 80,
    left: 40,
  },
  miniature: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'white',
    opacity: 0,
    transform: [{ scale: 0.5 }],
  },
  miniatureVisible: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  miniatureImage: {
    width: '100%',
    height: '100%',
  },
  miniatureOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#27ae60',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Styles pour les erreurs et permissions
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