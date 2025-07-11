import RNShare from 'react-native-share';
import React, { useState, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView, 
  Linking, 
  ActivityIndicator, 
  PanResponder,
  Animated
} from 'react-native';
import { saveSubmissionToFirebase, updateSubmissionInFirebase } from '../firebaseFunctions';
import RNPickerSelect from 'react-native-picker-select';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import CustomCamera from '../CustomCamera';
import * as FileSystem from 'expo-file-system';
import { testFirebaseConnection } from '../firebase';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ImageViewer from 'react-native-image-zoom-viewer';

const { width } = Dimensions.get('window');

// Composant ImageViewer avec react-native-image-zoom-viewer
const ImageViewerComponent = ({ photos, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  const images = photos.map(photo => ({
    url: photo.uri,
    props: {
      source: { uri: photo.uri }
    }
  }));

  return (
    <Modal visible={true} transparent={true} animationType="fade">
      <ImageViewer
        imageUrls={images}
        index={currentIndex}
        onCancel={onClose}
        onChange={(index) => setCurrentIndex(index)}
        enableSwipeDown={true}
        enableImageZoom={true}
        enablePreload={true}
        saveToLocalByLongPress={false}
        backgroundColor="white"
        renderIndicator={() => null}
        
        renderHeader={() => (
          <View style={[styles.modalHeader, { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]}>
            <Text style={[styles.modalPhotoCounter, { color: '#333' }]}>
              {currentIndex + 1} / {photos.length}
            </Text>
            <TouchableOpacity 
              style={styles.closeButtonFullScreen} 
              onPress={onClose}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <FontAwesome5 name="times" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        )}
        
        loadingRender={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        )}
        
        renderImage={(props) => {
          return (
            <Image
              {...props}
              style={[props.style, { backgroundColor: 'white' }]}
              resizeMode="contain"
            />
          );
        }}
        
        maxOverflow={0}
        doubleClickInterval={300}
        minScale={1}
        maxScale={4}
        onSwipeDown={onClose}
        swipeDownThreshold={100}
        footerContainerStyle={{ backgroundColor: 'transparent' }}
      />
    </Modal>
  );
};

const SoumissionForm = ({ prefilledData = null, onReturn, onComplete }) => {
  const pickerRefs = useRef({});

  const [formData, setFormData] = useState({
    nom: prefilledData?.client?.nom || '',
    adresse: prefilledData?.client?.adresse || '',
    telephone: prefilledData?.client?.telephone || '',
    courriel: prefilledData?.client?.courriel || '',
    dimensions: prefilledData?.toiture?.dimensions || [{ length: 0, width: 0, name: 'Section 1' }],  
    parapets: prefilledData?.toiture?.parapets || [{ length: 0, width: 0, name: 'Parapet 1' }],
    puitsLumiere: prefilledData?.toiture?.puitsLumiere || [{ length: 0, width: 0, name: 'Puit 1' }],
    nbFeuilles: prefilledData?.materiaux?.nbFeuilles || 0,
    nbMax: prefilledData?.materiaux?.nbMax || 0,
    nbEvents: prefilledData?.materiaux?.nbEvents || 0,
    nbDrains: prefilledData?.materiaux?.nbDrains || 0,
    trepiedElectrique: prefilledData?.materiaux?.trepiedElectrique || 0,
    plusieursEpaisseurs: prefilledData?.options?.plusieursEpaisseurs || false,
    hydroQuebec: prefilledData?.options?.hydroQuebec || false,
    grue: prefilledData?.options?.grue || false,
    trackfall: prefilledData?.options?.trackfall || false,
    notes: prefilledData?.notes || '',
    isAssignment: !!prefilledData,
    assignmentId: prefilledData?.id || null,
  });

  const [superficie, setSuperficie] = useState({ toiture: 0, parapets: 0, totale: 0 });
  const [photos, setPhotos] = useState(() => {
    if (prefilledData?.photos && prefilledData.photos.length > 0) {
      return prefilledData.photos.map((photoUrl, index) => {
        if (typeof photoUrl === 'string') {
          return {
            id: `photo_${index}_${Date.now()}`,
            uri: photoUrl
          };
        }
        return photoUrl;
      });
    }
    return [];
  });
  
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [notification, setNotification] = useState({ visible: false, message: '', type: '' });
  const [date] = useState(new Date());
  const [openSections, setOpenSections] = useState(['client', 'dimensions', 'parapets', 'materiaux', 'options', 'notes', 'photos']);
  const [showCamera, setShowCamera] = useState(false);

  // Formatage du numéro de téléphone
  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 10);
    if (limited.length >= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
    } else if (limited.length >= 3) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    }
    return limited;
  };

  const handlePhoneChange = (text) => {
    const formatted = formatPhoneNumber(text);
    setFormData({...formData, telephone: formatted});
  };

  // Calcul des superficies
  useEffect(() => {
    let totalToiture = formData.dimensions.reduce((sum, section) => {
      const length = parseFloat(section.length) || 0;
      const width = parseFloat(section.width) || 0;
      return sum + (length * width);
    }, 0);

    let totalParapets = formData.parapets.reduce((sum, parapet) => {
      const lengthInFeet = parseFloat(parapet.length) || 0;
      const widthInInches = parseFloat(parapet.width) || 0;
      return sum + (lengthInFeet * (widthInInches / 12));
    }, 0);

    setSuperficie({
      toiture: totalToiture,
      parapets: totalParapets,
      totale: Math.max(0, (totalToiture + totalParapets))
    });

    if (formData.nom === '' && formData.adresse === '') {
      testFirebaseConnection();
    }
  }, [formData]);

  // Partage avec RNShare
  const shareWithRNShare = async () => {
    try {
      const report = generateEvernoteReport();
      const subject = formData.adresse || 'Soumission Toiture';
      
      if (photos.length === 0) {
        await RNShare.open({ message: report, title: subject, subject: subject });
        showNotification('Rapport partagé', 'success');
        return;
      }

      const reportFileName = `rapport_${(formData.nom || 'client').replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      const reportPath = `${FileSystem.documentDirectory}${reportFileName}`;
      
      await FileSystem.writeAsStringAsync(reportPath, report);
      const allFiles = [reportPath, ...photos.map(photo => photo.uri)];

      await RNShare.open({
        title: subject,
        message: `Soumission complète avec ${photos.length} photo${photos.length > 1 ? 's' : ''}`,
        urls: allFiles,
        subject: subject,
        showAppsToView: true,
      });

      setTimeout(async () => {
        try {
          await FileSystem.deleteAsync(reportPath, { idempotent: true });
        } catch (error) {
          console.log('Nettoyage fichier:', error);
        }
      }, 5000);

      showNotification(`Rapport et ${photos.length} photo${photos.length > 1 ? 's' : ''} partagés !`, 'success');
    } catch (error) {
      if (error.message === 'User did not share') {
        console.log('Utilisateur a annulé le partage');
        return;
      }
      console.error('Erreur react-native-share:', error);
      showNotification('Erreur lors du partage', 'error');
    }
  };

  // Génération du rapport
  const generateEvernoteReport = () => {
    const currentDate = new Date().toLocaleDateString('fr-CA');
    const currentTime = new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
    const materiauxtTotal = formData.nbFeuilles + formData.nbMax + formData.nbEvents + formData.nbDrains + formData.trepiedElectrique;

    return `
${formData.adresse || 'Projet'}
===============================================
Date: ${currentDate} à ${currentTime}
Adresse: ${formData.adresse || 'Non spécifiée'}

INFORMATIONS CLIENT
-------------------
Nom: ${formData.nom || 'Non spécifié'}
Adresse: ${formData.adresse || 'Non spécifiée'}
Téléphone: ${formData.telephone || 'Non spécifié'}
Courriel: ${formData.courriel || 'Non spécifié'}

DIMENSIONS & SUPERFICIE
-----------------------
Superficie toiture: ${superficie.toiture.toFixed(2)} pi²
Superficie parapets: ${superficie.parapets.toFixed(2)} pi²
SUPERFICIE TOTALE: ${superficie.totale.toFixed(2)} pi²

SECTIONS TOITURE:
${formData.dimensions.map((section, index) => 
  `   ${section.name || `Section ${index + 1}`}: ${section.length} x ${section.width} pi = ${(section.length * section.width).toFixed(2)} pi²`
).join('\n')}

PARAPETS:
${formData.parapets.map((parapet, index) => 
  `   ${parapet.name || `Parapet ${index + 1}`}: ${parapet.length} pi x ${parapet.width} po = ${(parapet.length * (parapet.width / 12)).toFixed(2)} pi²`
).join('\n')}

MATÉRIAUX ET ACCESSOIRES
------------------------
Feuilles de tôles: ${formData.nbFeuilles}
Maximum: ${formData.nbMax}
Évents: ${formData.nbEvents}
Drains: ${formData.nbDrains}
Trépied électrique: ${formData.trepiedElectrique}
Total articles: ${materiauxtTotal}

PUITS DE LUMIÈRE
----------------
${formData.puitsLumiere.map((puit, index) => 
  `${puit.name}: ${puit.length}" x ${puit.width}"`
).join('\n')}

OPTIONS SPÉCIALES
-----------------
${formData.plusieursEpaisseurs ? '[X]' : '[ ]'} Plusieurs épaisseurs de toiture
${formData.hydroQuebec ? '[X]' : '[ ]'} Travaux Hydro Québec requis
${formData.grue ? '[X]' : '[ ]'} Grue nécessaire
${formData.trackfall ? '[X]' : '[ ]'} Trackfall et chute

NOTES SUPPLÉMENTAIRES
--------------------
${formData.notes || 'Aucune note spéciale'}

===============================================
Généré automatiquement par SoumissionToiture App
${currentDate} ${currentTime}
`;
  };

  // Enregistrement complet
  const handleEnregistrerComplet = async () => {
    if (!formData.adresse.trim()) {
      showNotification('Adresse du projet requise', 'error');
      return;
    }

    const hasPhotos = photos.length > 0;
    
    Alert.alert(
      'Enregistrer la soumission',
      hasPhotos 
        ? `Enregistrer et partager la soumission avec ${photos.length} photo${photos.length > 1 ? 's' : ''} ?`
        : 'Enregistrer et partager la soumission (aucune photo) ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Enregistrer', onPress: async () => { await processCompleteSubmission(); }, style: 'default' }
      ]
    );
  };

  // Process de soumission complet
  const processCompleteSubmission = async () => {
    try {
      showNotification('💾 Enregistrement en cours...', 'success');

      const isExistingAssignment = formData.isAssignment && formData.assignmentId;
      
      const address = formData.adresse || 'projet_sans_adresse';
      const submissionId = isExistingAssignment ? formData.assignmentId : address
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 60);

      // Upload des photos vers Firebase Storage
      showNotification('📸 Upload des photos...', 'success');
      const uploadedPhotoUrls = [];
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        
        // Vérifier si c'est déjà une URL Firebase
        if (photo.uri.startsWith('https://firebasestorage.googleapis.com')) {
          console.log(`Photo ${i + 1} déjà sur Firebase`);
          uploadedPhotoUrls.push(photo.uri);
          continue;
        }
        
        try {
          console.log(`Upload photo ${i + 1}/${photos.length}...`);
          
          const timestamp = Date.now();
          const photoName = `${submissionId}_photo_${i}_${timestamp}.jpg`;
          const storageRef = ref(storage, `soumissions/${submissionId}/${photoName}`);
          
          const response = await fetch(photo.uri);
          const blob = await response.blob();
          
          await uploadBytes(storageRef, blob);
          
          const downloadUrl = await getDownloadURL(storageRef);
          uploadedPhotoUrls.push(downloadUrl);
          
          console.log(`✅ Photo ${i + 1} uploadée avec succès`);
        } catch (photoError) {
          console.error(`Erreur upload photo ${i + 1}:`, photoError);
          showNotification(`⚠️ Erreur upload photo ${i + 1}`, 'error');
        }
      }

      const soumission = {
        date: date.toISOString().split('T')[0],
        client: { 
          nom: formData.nom, 
          adresse: formData.adresse, 
          telephone: formData.telephone, 
          courriel: formData.courriel 
        },
        toiture: { 
          superficie: superficie, 
          plusieursEpaisseurs: formData.plusieursEpaisseurs, 
          dimensions: formData.dimensions, 
          parapets: formData.parapets, 
          puitsLumiere: formData.puitsLumiere 
        },
        materiaux: { 
          nbFeuilles: formData.nbFeuilles, 
          nbMax: formData.nbMax, 
          nbEvents: formData.nbEvents, 
          nbDrains: formData.nbDrains, 
          trepiedElectrique: formData.trepiedElectrique 
        },
        options: { 
          hydroQuebec: formData.hydroQuebec, 
          grue: formData.grue, 
          trackfall: formData.trackfall 
        },
        notes: formData.notes,
        photos: uploadedPhotoUrls,
        photoCount: uploadedPhotoUrls.length,
        processed: true,
        exported: true,
        exportedAt: new Date().toISOString(),
        status: 'captured',
        wasAssignment: isExistingAssignment,
        completedAt: new Date().toISOString()
      };

      let firebaseResult;
      if (isExistingAssignment) {
        console.log('🔄 Mise à jour assignment existant:', submissionId);
        firebaseResult = await updateSubmissionInFirebase(submissionId, soumission);
      } else {
        console.log('💾 Création nouvelle soumission:', submissionId);
        firebaseResult = await saveSubmissionToFirebase(soumission);
      }
      
      if (firebaseResult.success) {
        showNotification('✅ Sauvegardé dans le cloud avec photos!', 'success');
      } else {
        showNotification('⚠️ Sauvegarde locale (cloud indisponible)', 'success');
      }

      showNotification('📤 Préparation du partage...', 'success');
      
      setTimeout(async () => {
        await shareWithRNShare();
        setTimeout(() => {
          showNotification('🎉 Soumission complétée avec succès !', 'success');
          if (onComplete) {
            onComplete(submissionId);
          }
        }, 1000);
      }, 500);

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement complet:', error);
      showNotification('❌ Erreur lors de l\'enregistrement', 'error');
    }
  };

  // Génération des items pour les pickers
  const generatePickerItems = (start, end) => {
    return Array.from({ length: end - start + 1 }, (_, i) => ({ label: `${start + i}`, value: start + i }));
  };

  // Réinitialisation du formulaire
  const resetForm = () => {
    setFormData({
      nom: '', adresse: '', telephone: '', courriel: '',
      dimensions: [{ length: 0, width: 0, name: 'Section 1' }],
      parapets: [{ length: 0, width: 0, name: 'Parapet 1' }],
      puitsLumiere: [{ length: 0, width: 0, name: 'Puit 1' }],
      nbFeuilles: 0, nbMax: 0, nbEvents: 0, nbDrains: 0, trepiedElectrique: 0,
      plusieursEpaisseurs: false, hydroQuebec: false, grue: false, trackfall: false, notes: ''
    });
    setPhotos([]);
    showNotification('Formulaire réinitialisé', 'success');
  };

  // Gestion des puits de lumière
  const addPuitLumiere = () => {
    setFormData({ ...formData, puitsLumiere: [...formData.puitsLumiere, { length: 0, width: 0, name: `Puit ${formData.puitsLumiere.length + 1}` }] });
  };

  const removePuitLumiere = (index) => {
    if (formData.puitsLumiere.length > 1) {
      const newPuits = [...formData.puitsLumiere];
      newPuits.splice(index, 1);
      setFormData({...formData, puitsLumiere: newPuits});
    }
  };

  const handlePuitLumiereChange = (index, field, value) => {
    const newPuits = [...formData.puitsLumiere];
    newPuits[index][field] = Number(value);
    setFormData({...formData, puitsLumiere: newPuits});
  };

  // Notification
  const showNotification = (message, type) => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification({ ...notification, visible: false }), 3000);
  };

  // Toggle sections
  const toggleSection = (section) => {
    setOpenSections(prevOpenSections => {
      if (prevOpenSections.includes(section)) {
        return prevOpenSections.filter(openSection => openSection !== section);
      } else {
        return [...prevOpenSections, section];
      }
    });
  };

  // Gestion des dimensions
  const handleDimensionChange = (sectionIndex, field, value) => {
    const newDimensions = [...formData.dimensions];
    newDimensions[sectionIndex][field] = Number(value);
    setFormData({...formData, dimensions: newDimensions});
  };

  const handleSectionNameChange = (index, newName) => {
    const newDimensions = [...formData.dimensions];
    newDimensions[index].name = newName;
    setFormData({...formData, dimensions: newDimensions});
  };

  const addDimensionSection = () => {
    setFormData({ ...formData, dimensions: [...formData.dimensions, { length: 0, width: 0, name: '' }] });
  };

  const removeDimensionSection = (index) => {
    if (formData.dimensions.length > 1) {
      const newDimensions = [...formData.dimensions];
      newDimensions.splice(index, 1);
      setFormData({...formData, dimensions: newDimensions});
    }
  };

  // Gestion des parapets
  const addParapetSection = () => {
    setFormData({ ...formData, parapets: [...formData.parapets, { length: 0, width: 0, name: '' }] });
  };

  const removeParapetSection = (index) => {
    if (formData.parapets.length > 1) {
      const newParapets = [...formData.parapets];
      newParapets.splice(index, 1);
      setFormData({...formData, parapets: newParapets});
    }
  };

  // Ouvrir picker
  const openPicker = (pickerKey) => {
    if (pickerRefs.current[pickerKey]) {
      pickerRefs.current[pickerKey].togglePicker();
    }
  };

  // Supprimer photo AVEC CONFIRMATION
  const deletePhoto = (id) => {
    Alert.alert(
      'Supprimer la photo',
      'Êtes-vous sûr de vouloir supprimer cette photo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: () => {
            setPhotos(photos.filter(photo => photo.id !== id));
            showNotification('Photo supprimée', 'success');
          }
        }
      ]
    );
  };

  // Ouvrir caméra
  const openCustomCamera = () => {
    setShowCamera(true);
  };

  // Gérer photo prise
  const handlePhotoTaken = (photo) => {
    setPhotos([...photos, photo]);
    showNotification('Photo ajoutée instantanément !', 'success');
  };

  // Header du formulaire
  const FormHeader = () => (
    <View style={styles.formHeader}>
      <TouchableOpacity style={styles.backButton} onPress={onReturn}>
        <FontAwesome5 name="arrow-left" size={20} color="white" />
        <Text style={styles.backText}>Retour</Text>
      </TouchableOpacity>
      
      <View style={styles.headerContent}>
        <Text style={styles.title}>
          {prefilledData ? 'Compléter Assignment' : 'Soumission Toiture'}
        </Text>
        {prefilledData ? (
          <Text style={styles.subtitle}>{prefilledData.client?.adresse || 'Assignment'}</Text>
        ) : (
          <Text style={styles.subtitle}>Capturez des photos et enregistrez votre projet</Text>
        )}
      </View>
    </View>
  );

  const pickerSelectStyles = StyleSheet.create({
    inputIOS: { opacity: 0, position: 'absolute', width: '100%', height: '100%', zIndex: 99999 },
    inputAndroid: { opacity: 0, position: 'absolute', width: '100%', height: '100%', elevation: 99999 },
  });

  return (
    <View style={styles.container}>
      <FormHeader />
      
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
          
          {/* Section Informations client */}
          <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('client')}>
            <FontAwesome5 name="user" size={20} color="white" />
            <Text style={styles.sectionTitle}>Informations client</Text>
            <FontAwesome5 name={openSections.includes('client') ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
          </TouchableOpacity>
          
          {openSections.includes('client') && (
            <View style={[styles.sectionContent, styles.nonPickerSection]}>
              <Text style={styles.label}>Nom du client</Text>
              <TextInput style={styles.input} value={formData.nom} onChangeText={text => setFormData({...formData, nom: text})} placeholder="Nom complet" />
              
              <Text style={styles.label}>Adresse des travaux *</Text>
              <TextInput style={[styles.input, styles.requiredInput]} value={formData.adresse} onChangeText={text => setFormData({...formData, adresse: text})} placeholder="Adresse complète" />
              
              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Téléphone</Text>
                  <View style={styles.phoneContainer}>
                    <TextInput 
                      style={[styles.input, styles.phoneInput]} 
                      value={formData.telephone} 
                      onChangeText={handlePhoneChange} 
                      placeholder="514-783-2794" 
                      keyboardType="phone-pad" 
                      maxLength={12} 
                    />
                    {formData.telephone && formData.telephone.length >= 10 && (
                      <TouchableOpacity
                        style={styles.callButton}
                        onPress={() => {
                          const cleanNumber = formData.telephone.replace(/[^0-9]/g, '');
                          if (cleanNumber.length >= 10) {
                            Linking.openURL(`tel:${cleanNumber}`);
                          }
                        }}
                      >
                        <FontAwesome5 name="phone" size={12} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Courriel</Text>
                  <TextInput style={styles.input} value={formData.courriel} onChangeText={text => setFormData({...formData, courriel: text})} placeholder="email@exemple.com" keyboardType="email-address" />
                </View>
              </View>
            </View>
          )}

          {/* Section Dimensions de la toiture */}
          <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('dimensions')}>
            <FontAwesome5 name="ruler-combined" size={20} color="white" />
            <Text style={styles.sectionTitle}>Dimensions de la toiture</Text>
            <FontAwesome5 name={openSections.includes('dimensions') ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
          </TouchableOpacity>
          
          {openSections.includes('dimensions') && (
            <View style={[styles.sectionContent, styles.pickerSection]}>
              {formData.dimensions.map((section, index) => (
                <View key={`dim-section-${index}`} style={styles.dimSetContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <TextInput style={styles.sectionNameInput} value={section.name || `Section ${index + 1}`} onChangeText={(text) => handleSectionNameChange(index, text)} placeholder="Ex: Hangar" />
                  </View>
                  
                  <View style={styles.dimRow}>
                    <View style={styles.pickerContainer}>
                      <Text style={styles.pickerLabel}>Longueur (pieds)</Text>
                      <TouchableOpacity style={styles.pickerTouchable} onPress={() => openPicker(`length-${index}`)}>
                        <Text style={styles.pickerValueText}>{section.length || "0"}</Text>
                        <RNPickerSelect ref={el => pickerRefs.current[`length-${index}`] = el} onValueChange={(value) => handleDimensionChange(index, 'length', value)} items={generatePickerItems(0, 200)} value={section.length} style={pickerSelectStyles} placeholder={{}} useNativeAndroidPickerStyle={false} />
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.multiply}>×</Text>
                    
                    <View style={styles.pickerContainer}>
                      <Text style={styles.pickerLabel}>Largeur (pieds)</Text>
                      <TouchableOpacity style={styles.pickerTouchable} onPress={() => openPicker(`width-${index}`)}>
                        <Text style={styles.pickerValueText}>{section.width || "0"}</Text>
                        <RNPickerSelect ref={el => pickerRefs.current[`width-${index}`] = el} onValueChange={(value) => handleDimensionChange(index, 'width', value)} items={generatePickerItems(0, 200)} value={section.width} style={pickerSelectStyles} placeholder={{}} useNativeAndroidPickerStyle={false} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {index > 0 && (
                    <TouchableOpacity style={styles.removeSectionButton} onPress={() => removeDimensionSection(index)}>
                      <Text style={styles.deleteX}>✕</Text>
                      <Text style={styles.removeSectionButtonText}>Supprimer cette section</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View style={styles.addSectionButtonContainer}>
                <TouchableOpacity style={styles.addSectionButton} onPress={addDimensionSection}>
                  <Text style={{color: '#3498db', fontSize: 16}}>➕</Text>
                  <Text style={styles.addSectionButtonText}>Ajouter une section</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.totalSurfaceContainer}>
                <Text style={styles.totalSurfaceLabel}>Superficie totale:</Text>
                <Text style={styles.totalSurfaceValue}>{superficie.totale.toFixed(2)} pi²</Text>
              </View>
            </View>
          )}

          {/* Section Dimensions des parapets */}
          <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('parapets')}>
            <FontAwesome5 name="ruler-vertical" size={20} color="white" />
            <Text style={styles.sectionTitle}>Dimensions des parapets</Text>
            <FontAwesome5 name={openSections.includes('parapets') ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
          </TouchableOpacity>
          
          {openSections.includes('parapets') && (
            <View style={[styles.sectionContent, styles.pickerSection]}>
              {formData.parapets.map((parapet, index) => (
                <View key={`parapet-${index}`} style={styles.dimSetContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <TextInput
                      style={styles.sectionNameInput}
                      value={parapet.name || `Parapet ${index + 1}`}
                      onChangeText={(text) => {
                        const newParapets = [...formData.parapets];
                        newParapets[index].name = text;
                        setFormData({...formData, parapets: newParapets});
                      }}
                      placeholder="Ex: Parapet nord"
                    />
                  </View>

                  <View style={styles.dimRow}>
                    <View style={styles.pickerContainer}>
                      <Text style={styles.pickerLabel}>Longueur (pieds)</Text>
                      <TouchableOpacity style={styles.pickerTouchable} onPress={() => openPicker(`parapet-length-${index}`)}>
                        <Text style={styles.pickerValueText}>{parapet.length || "0"}</Text>
                        <RNPickerSelect
                          ref={el => pickerRefs.current[`parapet-length-${index}`] = el}
                          onValueChange={(value) => {
                            const newParapets = [...formData.parapets];
                            newParapets[index].length = value;
                            setFormData({...formData, parapets: newParapets});
                          }}
                          items={generatePickerItems(0, 200)}
                          value={parapet.length}
                          style={pickerSelectStyles}
                        />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.multiply}>×</Text>

                    <View style={styles.pickerContainer}>
                      <Text style={styles.pickerLabel}>Largeur (pouces)</Text>
                      <TouchableOpacity style={styles.pickerTouchable} onPress={() => openPicker(`parapet-width-${index}`)}>
                        <Text style={styles.pickerValueText}>{parapet.width || "0"}</Text>
                        <RNPickerSelect
                          ref={el => pickerRefs.current[`parapet-width-${index}`] = el}
                          onValueChange={(value) => {
                            const newParapets = [...formData.parapets];
                            newParapets[index].width = value;
                            setFormData({...formData, parapets: newParapets});
                          }}
                          items={generatePickerItems(0, 200)}
                          value={parapet.width}
                          style={pickerSelectStyles}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {index > 0 && (
                    <TouchableOpacity style={styles.removeSectionButton} onPress={() => removeParapetSection(index)}>
                      <Text style={styles.deleteX}>✕</Text>
                      <Text style={styles.removeSectionButtonText}>Supprimer ce parapet</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View style={styles.addSectionButtonContainer}>
                <TouchableOpacity style={styles.addSectionButton} onPress={addParapetSection}>
                  <Text style={{color: '#3498db', fontSize: 16}}>➕</Text>
                  <Text style={styles.addSectionButtonText}>Ajouter un parapet</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.totalSurfaceContainer}>
                <Text style={styles.totalSurfaceLabel}>Superficie des parapets:</Text>
                <Text style={styles.totalSurfaceValue}>{superficie.parapets.toFixed(2)} pi²</Text>
              </View>
            </View>
          )}

          {/* Section Matériaux et accessoires */}
          <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('materiaux')}>
            <FontAwesome5 name="tools" size={20} color="white" />
            <Text style={styles.sectionTitle}>Matériaux et accessoires</Text>
            <FontAwesome5 name={openSections.includes('materiaux') ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
          </TouchableOpacity>
          
          {openSections.includes('materiaux') && (
            <View style={[styles.sectionContent, styles.pickerSection]}>
              <View style={styles.materiauxGrid}>
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Feuilles de tôles</Text>
                  <TouchableOpacity style={styles.pickerTouchable} onPress={() => openPicker('nbFeuilles')}>
                    <Text style={styles.pickerValueText}>{formData.nbFeuilles || "0"}</Text>
                    <RNPickerSelect
                      ref={el => pickerRefs.current['nbFeuilles'] = el}
                      onValueChange={(value) => setFormData({...formData, nbFeuilles: value})}
                      items={generatePickerItems(0, 200)}
                      value={formData.nbFeuilles}
                      style={pickerSelectStyles}
                      placeholder={{}}
                      useNativeAndroidPickerStyle={false}
                    />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Maximum</Text>
                  <TouchableOpacity style={styles.pickerTouchable} onPress={() => openPicker('nbMax')}>
                    <Text style={styles.pickerValueText}>{formData.nbMax || "0"}</Text>
                    <RNPickerSelect
                      ref={el => pickerRefs.current['nbMax'] = el}
                      onValueChange={(value) => setFormData({...formData, nbMax: value})}
                      items={generatePickerItems(0, 200)}
                      value={formData.nbMax}
                      style={pickerSelectStyles}
                      placeholder={{}}
                      useNativeAndroidPickerStyle={false}
                    />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Évents</Text>
                  <TouchableOpacity style={styles.pickerTouchable} onPress={() => openPicker('nbEvents')}>
                    <Text style={styles.pickerValueText}>{formData.nbEvents || "0"}</Text>
                    <RNPickerSelect
                      ref={el => pickerRefs.current['nbEvents'] = el}
                      onValueChange={(value) => setFormData({...formData, nbEvents: value})}
                      items={generatePickerItems(0, 200)}
                      value={formData.nbEvents}
                      style={pickerSelectStyles}
                      placeholder={{}}
                      useNativeAndroidPickerStyle={false}
                    />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Drains</Text>
                  <TouchableOpacity style={styles.pickerTouchable} onPress={() => openPicker('nbDrains')}>
                    <Text style={styles.pickerValueText}>{formData.nbDrains || "0"}</Text>
                    <RNPickerSelect
                      ref={el => pickerRefs.current['nbDrains'] = el}
                      onValueChange={(value) => setFormData({...formData, nbDrains: value})}
                      items={generatePickerItems(0, 200)}
                      value={formData.nbDrains}
                      style={pickerSelectStyles}
                      placeholder={{}}
                      useNativeAndroidPickerStyle={false}
                    />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Trépied électrique</Text>
                  <TouchableOpacity style={styles.pickerTouchable} onPress={() => openPicker('trepiedElectrique')}>
                    <Text style={styles.pickerValueText}>{formData.trepiedElectrique || "0"}</Text>
                    <RNPickerSelect
                      ref={el => pickerRefs.current['trepiedElectrique'] = el}
                      onValueChange={(value) => setFormData({...formData, trepiedElectrique: value})}
                      items={generatePickerItems(0, 200)}
                      value={formData.trepiedElectrique}
                      style={pickerSelectStyles}
                      placeholder={{}}
                      useNativeAndroidPickerStyle={false}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Section Puits de lumière */}
              <View style={styles.dimSectionContainer}>
                <Text style={styles.subSectionHeader}>Puits de lumière (en pouces)</Text>
                
                {formData.puitsLumiere.map((puit, index) => (
                  <View key={`puit-${index}`} style={[styles.dimSetContainer, { marginBottom: 10 }]}>
                    <View style={styles.sectionHeaderRow}>
                      <TextInput
                        style={styles.sectionNameInput}
                        value={puit.name}
                        onChangeText={(text) => {
                          const newPuits = [...formData.puitsLumiere];
                          newPuits[index].name = text;
                          setFormData({...formData, puitsLumiere: newPuits});
                        }}
                        placeholder={`Puit ${index + 1}`}
                      />
                    </View>

                    <View style={styles.dimRow}>
                      <View style={styles.pickerContainer}>
                        <Text style={styles.pickerLabel}>Longueur (pouces)</Text>
                        <TouchableOpacity style={[styles.pickerTouchable, { height: 45 }]} onPress={() => openPicker(`puit-length-${index}`)}>
                          <Text style={styles.pickerValueText}>{puit.length || "0"}</Text>
                          <RNPickerSelect
                            ref={el => pickerRefs.current[`puit-length-${index}`] = el}
                            onValueChange={(value) => handlePuitLumiereChange(index, 'length', value)}
                            items={generatePickerItems(0, 200)}
                            value={puit.length}
                            style={pickerSelectStyles}
                          />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.multiply}>×</Text>

                      <View style={styles.pickerContainer}>
                        <Text style={styles.pickerLabel}>Largeur (pouces)</Text>
                        <TouchableOpacity style={[styles.pickerTouchable, { height: 45 }]} onPress={() => openPicker(`puit-width-${index}`)}>
                          <Text style={styles.pickerValueText}>{puit.width || "0"}</Text>
                          <RNPickerSelect
                            ref={el => pickerRefs.current[`puit-width-${index}`] = el}
                            onValueChange={(value) => handlePuitLumiereChange(index, 'width', value)}
                            items={generatePickerItems(0, 200)}
                            value={puit.width}
                            style={pickerSelectStyles}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {index > 0 && (
                      <TouchableOpacity style={styles.removeSectionButton} onPress={() => removePuitLumiere(index)}>
                        <Text style={styles.deleteX}>✕</Text>
                        <Text style={styles.removeSectionButtonText}>Supprimer ce puit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <View style={[styles.addSectionButtonContainer, { marginTop: 5 }]}>
                  <TouchableOpacity style={[styles.addSectionButton, { paddingVertical: 10 }]} onPress={addPuitLumiere}>
                    <Text style={{color: '#3498db', fontSize: 16}}>➕</Text>
                    <Text style={styles.addSectionButtonText}>Ajouter un puit de lumière</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Section Options */}
          <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('options')}>
            <FontAwesome5 name="cogs" size={20} color="white" />
            <Text style={styles.sectionTitle}>Autres options</Text>
            <FontAwesome5 name={openSections.includes('options') ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
          </TouchableOpacity>
          
          {openSections.includes('options') && (
            <View style={[styles.sectionContent, styles.nonPickerSection]}>
              <TouchableOpacity 
                style={styles.checkboxItem} 
                onPress={() => setFormData({...formData, plusieursEpaisseurs: !formData.plusieursEpaisseurs})}
              >
                <Text style={{fontSize: 32, color: '#3498db'}}>
                  {formData.plusieursEpaisseurs ? '☑' : '☐'}
                </Text>
                <Text style={styles.checkboxLabel}>Plusieurs épaisseurs de toiture</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.checkboxItem} 
                onPress={() => setFormData({...formData, hydroQuebec: !formData.hydroQuebec})}
              >
                <Text style={{fontSize: 32, color: '#3498db'}}>
                  {formData.hydroQuebec ? '☑' : '☐'}
                </Text>
                <Text style={styles.checkboxLabel}>Travaux Hydro Québec requis</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.checkboxItem} 
                onPress={() => setFormData({...formData, grue: !formData.grue})}
              >
                <Text style={{fontSize: 32, color: '#3498db'}}>
                  {formData.grue ? '☑' : '☐'}
                </Text>
                <Text style={styles.checkboxLabel}>Grue nécessaire</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.checkboxItem} 
                onPress={() => setFormData({...formData, trackfall: !formData.trackfall})}
              >
                <Text style={{fontSize: 32, color: '#3498db'}}>  
                  {formData.trackfall ? '☑' : '☐'}
                </Text>
                <Text style={styles.checkboxLabel}>Trackfall et chute</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Section Notes */}
          <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('notes')}>
            <FontAwesome5 name="sticky-note" size={20} color="white" />
            <Text style={styles.sectionTitle}>Notes supplémentaires</Text>
            <FontAwesome5 name={openSections.includes('notes') ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
          </TouchableOpacity>
          
          {openSections.includes('notes') && (
            <View style={[styles.sectionContent, styles.nonPickerSection]}>
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

          {/* Section Photos avec style Evernote AMÉLIORÉ */}
          <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('photos')}>
            <FontAwesome5 name="camera" size={20} color="white" />
            <Text style={styles.sectionTitle}>Photos du projet</Text>
            <FontAwesome5 name={openSections.includes('photos') ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
          </TouchableOpacity>

          {openSections.includes('photos') && (
            <View style={[styles.sectionContent, styles.nonPickerSection, styles.photosSectionEvernote]}>
              {/* Bouton d'ajout en haut */}
              <TouchableOpacity style={styles.addPhotoButtonEvernote} onPress={openCustomCamera}>
                <FontAwesome5 name="camera" size={20} color="white" />
                <Text style={styles.addPhotoTextEvernote}>Ajouter des photos</Text>
              </TouchableOpacity>
              
              {/* Liste des photos */}
              {photos.length > 0 && (
                <>
                  {photos.map((photo, index) => (
                    <TouchableOpacity 
                      key={photo.id} 
                      style={styles.photoItemEvernote}
                      onPress={() => setSelectedPhoto(photo)}
                      activeOpacity={0.9}
                    >
                      <Image 
                        source={{ uri: photo.uri }} 
                        style={styles.photoEvernote}
                        resizeMode="cover"
                      />
                      <TouchableOpacity 
                        style={styles.deleteButtonEvernote} 
                        onPress={() => deletePhoto(photo.id)}
                      >
                        <FontAwesome5 name="trash" size={16} color="white" />
                      </TouchableOpacity>
                      <View style={styles.photoNumber}>
                        <Text style={styles.photoNumberText}>{index + 1}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  <View style={styles.photoCountSummary}>
                    <Text style={styles.photoCountText}>
                      {photos.length} photo{photos.length > 1 ? 's' : ''} ajoutée{photos.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                </>
              )}
              
              {/* Message si pas de photos */}
              {photos.length === 0 && (
                <View style={styles.noPhotosContainer}>
                  <FontAwesome5 name="image" size={50} color="#dfe6e9" />
                  <Text style={styles.noPhotosText}>Aucune photo ajoutée</Text>
                </View>
              )}
            </View>
          )}

          {/* Boutons d'action */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.mainSaveButton} onPress={handleEnregistrerComplet}>
              <FontAwesome5 name="save" size={18} color="white" />
              <Text style={styles.buttonText}>Enregistrer</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.resetButton} onPress={resetForm}>
              <FontAwesome5 name="redo" size={18} color="#2c3e50" />
              <Text style={styles.resetButtonText}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Caméra custom */}
      <CustomCamera visible={showCamera} onClose={() => setShowCamera(false)} onPhotoTaken={handlePhotoTaken} />

      {/* Visualiseur de photos */}
      {selectedPhoto && (
        <ImageViewerComponent 
          photos={photos} 
          initialIndex={photos.indexOf(selectedPhoto)} 
          onClose={() => setSelectedPhoto(null)} 
        />
      )}

      {/* Notification */}
      {notification.visible && (
        <View style={[styles.notification, notification.type === 'success' ? styles.successNotification : styles.errorNotification]}>
          <Text style={{color: 'white', fontSize: 20}}>{notification.type === 'success' ? '✅' : '⚠️'}</Text>
          <Text style={styles.notificationText}>{notification.message}</Text>
        </View>
      )}

      <StatusBar style="light" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  formHeader: { backgroundColor: '#2c3e50', flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  backText: { color: 'white', marginLeft: 8, fontSize: 16 },
  headerContent: { flex: 1 },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 14 },
  scrollContainer: { flex: 1 },
  sectionHeader: { backgroundColor: '#3498db', padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 10, marginTop: 15, borderRadius: 8 },
  sectionTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 10, flex: 1 },
  sectionContent: { backgroundColor: 'white', padding: 15, marginHorizontal: 10, marginBottom: 10, borderRadius: 8 },
  pickerSection: { zIndex: 9999, elevation: 9999 },
  nonPickerSection: { zIndex: 1, elevation: 1 },
  label: { marginBottom: 5, fontWeight: '500', color: '#2c3e50', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#dfe6e9', borderRadius: 8, padding: 12, marginBottom: 15, backgroundColor: 'white', fontSize: 15 },
  requiredInput: { borderColor: '#e74c3c', borderWidth: 2 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  gridItem: { width: '48%' },
  dimRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  pickerContainer: { flex: 1 },
  pickerTouchable: { height: 50, borderWidth: 1, borderColor: '#dfe6e9', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: 'white', marginBottom: 15 },
  pickerValueText: { fontSize: 16, color: '#2d3436' },
  pickerLabel: { fontSize: 12, color: '#7f8c8d', marginBottom: 2 },
  multiply: { fontWeight: 'bold', color: '#3498db', fontSize: 18, marginHorizontal: 5 },
  materiauxGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', zIndex: 10000, elevation: 10000 },
  materiauxItem: { width: '48%', marginBottom: 15, zIndex: 10001, elevation: 10001 },
  deleteX: { color: '#e74c3c', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  checkboxItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 10 },
  checkboxLabel: { marginLeft: 10, color: '#333', fontSize: 15 },
  notesInput: { minHeight: 100, textAlignVertical: 'top', fontSize: 15, borderWidth: 1, borderColor: '#dfe6e9', borderRadius: 8, padding: 12, backgroundColor: 'white' },
  buttonContainer: { marginHorizontal: 10, marginTop: 20, marginBottom: 30 },
  mainSaveButton: { flexDirection: 'row', backgroundColor: '#2dbe60', padding: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  resetButton: { flexDirection: 'row', backgroundColor: 'white', borderWidth: 1, borderColor: '#dfe6e9', padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 3 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16, marginLeft: 8 },
  resetButtonText: { color: '#2c3e50', fontWeight: '600', fontSize: 16, marginLeft: 8 },
  notification: { position: 'absolute', bottom: 30, left: 20, right: 20, padding: 15, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, zIndex: 99999 },
  successNotification: { backgroundColor: '#27ae60' },
  errorNotification: { backgroundColor: '#e74c3c' },
  notificationText: { color: 'white', fontWeight: '500', marginLeft: 10 },
  dimSetContainer: { marginTop: 5, padding: 5, backgroundColor: '#f8f9fa', borderRadius: 8, borderWidth: 1, borderColor: '#e9ecef', marginBottom: 20, zIndex: 9998, elevation: 9998, position: 'relative' },
  addSectionButtonContainer: { width: '100%', marginTop: 5, marginBottom: 20 },
  addSectionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#3498db', borderRadius: 8, backgroundColor: 'rgba(52, 152, 219, 0.1)' },
  addSectionButtonText: { color: '#3498db', marginLeft: 8, fontSize: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionNameInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 5, padding: 8, marginRight: 10, backgroundColor: '#fff' },
  removeSectionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, marginTop: 5 },
  removeSectionButtonText: { color: '#e74c3c', marginLeft: 5, fontSize: 13 },
  totalSurfaceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#3498db' },
  totalSurfaceLabel: { fontSize: 16, fontWeight: '500', color: '#2c3e50' },
  totalSurfaceValue: { fontSize: 18, fontWeight: 'bold', color: '#3498db' },
  dimSectionContainer: { marginHorizontal: 0, marginTop: 0, marginBottom: 1, zIndex: 10000, elevation: 10000 },
  subSectionHeader: { fontSize: 16, fontWeight: '600', color: '#2c3e50', marginBottom: 1, marginHorizontal: 30 },
  phoneContainer: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  phoneInput: { flex: 1, paddingRight: 50 },
  callButton: { position: 'absolute', right: 8, top: 8, bottom: 8, width: 30, backgroundColor: '#27ae60', borderRadius: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  
  // Styles pour les photos Evernote
  photosSectionEvernote: { padding: 0, backgroundColor: '#f5f7fa' },
  addPhotoButtonEvernote: { backgroundColor: '#3498db', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, margin: 15, borderRadius: 8 },
  addPhotoTextEvernote: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  photoItemEvernote: { marginHorizontal: 15, marginBottom: 15, borderRadius: 8, overflow: 'hidden', backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  photoEvernote: { width: '100%', height: 300 },
  deleteButtonEvernote: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(231, 76, 60, 0.9)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  photoNumber: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0, 0, 0, 0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  photoNumberText: { color: 'white', fontSize: 14, fontWeight: '600' },
  noPhotosContainer: { alignItems: 'center', paddingVertical: 50 },
  noPhotosText: { color: '#95a5a6', fontSize: 16, marginTop: 10 },
  photoCountSummary: { alignItems: 'center', paddingVertical: 20, marginTop: 10 },
  photoCountText: { color: '#666', fontSize: 14, fontStyle: 'italic' },
  
  // Styles pour le viewer
  modalHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'rgba(255, 255, 255, 0.95)', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', zIndex: 10 },
  modalPhotoCounter: { color: '#333', fontSize: 18, fontWeight: '600' },
  closeButtonFullScreen: { padding: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  loadingText: { marginTop: 10, color: '#666', fontSize: 16 },
});

export default SoumissionForm;