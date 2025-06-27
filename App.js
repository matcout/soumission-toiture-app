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
  Share,
  KeyboardAvoidingView
} from 'react-native';

import RNPickerSelect from 'react-native-picker-select';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import CustomCamera from './CustomCamera';

import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

const App = () => {
  const pickerRefs = useRef({});

  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    courriel: '',
    dimensions: [{ length: 0, width: 0, name: 'Section 1' }],
    parapets: [{ length: 0, width: 0, name: 'Parapet 1' }],
    puitsLumiere: [{ length: 0, width: 0, name: 'Puit 1' }],
    nbFeuilles: 0,
    nbMax: 0,
    nbEvents: 0,
    nbDrains: 0,
    trepiedElectrique: 0,
    ff180: 0,
    armorbound180: 0,
    plusieursEpaisseurs: false,
    hydroQuebec: false,
    grue: false,
    trackfall: false,
    notes: ''
  });

  const [superficie, setSuperficie] = useState({
    toiture: 0,
    parapets: 0,
    totale: 0
  });

  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [notification, setNotification] = useState({ visible: false, message: '', type: '' });
  const [date] = useState(new Date());
  const [activeSection, setActiveSection] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const formatPhoneNumber = (value) => {
  const cleaned = value.replace(/\D/g, '');
  const limited = cleaned.slice(0, 10);
  
  if (limited.length >= 6) {
    return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
  } else if (limited.length >= 3) {
    return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  } else {
    return limited;
  }
};

const handlePhoneChange = (text) => {
  const formatted = formatPhoneNumber(text);
  setFormData({...formData, telephone: formatted});
};

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
  }, [formData]);

// 🚀 SOLUTION PARFAITE: react-native-share pour Expo Dev Build
const shareWithRNShare = async () => {
  try {
    const report = generateEvernoteReport();
    const subject = `SOUMISSION - ${formData.nom || 'Client'} - ${formData.adresse || 'Projet'}`;
    
    if (photos.length === 0) {
      await RNShare.open({
        message: report,
        title: subject,
        subject: subject,
      });
      showNotification('Rapport partagé', 'success');
      return;
    }

 
  // Créer un fichier texte avec le rapport complet
    const reportFileName = `rapport_${(formData.nom || 'client').replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    const reportPath = `${FileSystem.documentDirectory}${reportFileName}`;
    await FileSystem.writeAsStringAsync(reportPath, report);

    // Préparer toutes les URLs pour react-native-share
    const allFiles = [reportPath, ...photos.map(photo => photo.uri)];

    // 🎯 PARTAGE NATIF AVEC TOUT !
    await RNShare.open({
      title: subject,
      message: `Soumission complète avec ${photos.length} photo${photos.length > 1 ? 's' : ''}`,
      urls: allFiles,
      subject: subject,
      showAppsToView: true,
    });

    // Nettoyer
    setTimeout(async () => {
      try {
        await FileSystem.deleteAsync(reportPath, { idempotent: true });
      } catch (error) {
        console.log('Nettoyage:', error);
      }
    }, 5000);

    showNotification(`Rapport et ${photos.length} photo${photos.length > 1 ? 's' : ''} partagés !`, 'success');

} catch (error) {
  // 🎯 GÉRER L'ANNULATION UTILISATEUR
  if (error.message === 'User did not share') {
    // L'utilisateur a annulé - c'est normal, pas d'erreur
    console.log('Utilisateur a annulé le partage');
    return;
  }
  
  // Vraie erreur
  console.error('Erreur react-native-share:', error);
  showNotification('Erreur lors du partage', 'error');
}
};


  // Fonction pour générer le rapport Evernote formaté
  const generateEvernoteReport = () => {
    const currentDate = new Date().toLocaleDateString('fr-CA');
    const currentTime = new Date().toLocaleTimeString('fr-CA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Calculs pour le rapport
    const materiauxtTotal = formData.nbFeuilles + formData.nbMax + formData.nbEvents + 
                           formData.nbDrains + formData.trepiedElectrique;

    const report = `
SOUMISSION TOITURE - ${formData.adresse || 'Projet'}
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

    return report;
  };

 
// Fonction mise à jour pour le choix d'export AVEC PHOTOS
const handleEvernoteExport = () => {
  if (!formData.adresse.trim()) {
    showNotification('Adresse du projet requise pour export', 'error');
    return;
  }

  const hasPhotos = photos.length > 0;
  
  Alert.alert(
    'Exporter vers Evernote',
    hasPhotos 
      ? `Exporter la soumission avec ${photos.length} photo${photos.length > 1 ? 's' : ''} ?`
      : 'Exporter la soumission (aucune photo) ?',
    [
      {
        text: 'Annuler',
        style: 'cancel'
      },
      {
        text: 'Partage natif TOUT',
        onPress: shareWithRNShare,
        style: 'default'
      }
    ]
  );
};

  const generatePickerItems = (start, end) => {
    return Array.from({ length: end - start + 1 }, (_, i) => ({
      label: `${start + i}`, 
      value: start + i,
    }));
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      adresse: '',
      telephone: '',
      courriel: '',
      dimensions: [{ length: 0, width: 0, name: 'Section 1' }],
      parapets: [{ length: 0, width: 0, name: 'Parapet 1' }],
      puitsLumiere: [{ length: 0, width: 0, name: 'Puit 1' }],
      nbFeuilles: 0,
      nbMax: 0,
      nbEvents: 0,
      nbDrains: 0,
      trepiedElectrique: 0,
      ff180: 0,
      armorbound180: 0,
      plusieursEpaisseurs: false,
      hydroQuebec: false,
      grue: false,
      trackfall: false,
      notes: ''
    });
    setPhotos([]);
    showNotification('Formulaire réinitialisé', 'success');
  };

  const addPuitLumiere = () => {
    setFormData({
      ...formData,
      puitsLumiere: [...formData.puitsLumiere, { length: 0, width: 0, name: `Puit ${formData.puitsLumiere.length + 1}` }]
    });
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

 const enregistrerSoumission = () => {
  if (!formData.adresse.trim()) {
    showNotification('Adresse des travaux obligatoire', 'error');
    return;
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
      plusieursEpaisseurs: formData.plusieursEpaisseurs
    },
    materiaux: {
      nbFeuilles: formData.nbFeuilles,
      nbMax: formData.nbMax,
      nbEvents: formData.nbEvents,
      nbDrains: formData.nbDrains,
      trepiedElectrique: formData.trepiedElectrique,
      ff180: formData.ff180,
      armorbound180: formData.armorbound180
    },
    options: {
      hydroQuebec: formData.hydroQuebec,
      grue: formData.grue,
      trackfall: formData.trackfall
    },
    notes: formData.notes,
    photos: photos.map(photo => photo.uri)
  };

    Alert.alert(
    'Soumission enregistrée',
    `Projet: ${formData.adresse}\nSuperficie: ${superficie.totale.toFixed(2)} pieds²`,
    [{ text: 'OK' }]
  );
  showNotification('Soumission enregistrée avec succès', 'success');
};

  const showNotification = (message, type) => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification({ ...notification, visible: false }), 3000);
  };

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? null : section);
  };

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
    setFormData({
      ...formData,
      dimensions: [...formData.dimensions, { length: 0, width: 0, name: '' }]
    });
  };

  const removeDimensionSection = (index) => {
    if (formData.dimensions.length > 1) {
      const newDimensions = [...formData.dimensions];
      newDimensions.splice(index, 1);
      setFormData({...formData, dimensions: newDimensions});
    }
  };

  const addParapetSection = () => {
    setFormData({
      ...formData,
      parapets: [...formData.parapets, { length: 0, width: 0, name: '' }]
    });
  };

  const removeParapetSection = (index) => {
    if (formData.parapets.length > 1) {
      const newParapets = [...formData.parapets];
      newParapets.splice(index, 1);
      setFormData({...formData, parapets: newParapets});
    }
  };

  const openPicker = (pickerKey) => {
    if (pickerRefs.current[pickerKey]) {
      pickerRefs.current[pickerKey].togglePicker();
    }
  };

  const deletePhoto = (id) => {
    setPhotos(photos.filter(photo => photo.id !== id));
  };

  const openCustomCamera = () => {
    setShowCamera(true);
  };

  const handlePhotoTaken = (photo) => {
    setPhotos([...photos, photo]);
    showNotification('Photo ajoutée instantanément !', 'success');
  };

  const pickerSelectStyles = StyleSheet.create({
    inputIOS: {
      opacity: 0,
      position: 'absolute',
      width: '100%',
      height: '100%',
      zIndex: 99999,
    },
    inputAndroid: {
      opacity: 0,
      position: 'absolute',
      width: '100%',
      height: '100%',
      elevation: 99999,
    },
    modalViewTop: {
      zIndex: 99999,
      elevation: 99999,
    },
    modalViewMiddle: {
      zIndex: 99999,
      elevation: 99999,
    },
    modalViewBottom: {
      zIndex: 99999,
      elevation: 99999,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Soumission Toiture</Text>
        <Text style={styles.subtitle}>Capturez des photos et enregistrez votre projet</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
         <ScrollView 
    style={styles.scrollContainer}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ paddingBottom: 100 }}
         >
        {/* Section Informations client */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('client')}>
          <FontAwesome5 name="user" size={20} color="white" />
          <Text style={styles.sectionTitle}>Informations client</Text>
          <FontAwesome5 name={activeSection === 'client' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
       {activeSection === 'client' && (
  <View style={[styles.sectionContent, styles.nonPickerSection]}>
    <Text style={styles.label}>Nom du client</Text>
    <TextInput
      style={styles.input}
      value={formData.nom}
      onChangeText={text => setFormData({...formData, nom: text})}
      placeholder="Nom complet"
    />
    
    <Text style={styles.label}>Adresse des travaux *</Text>
    <TextInput
      style={[styles.input, styles.requiredInput]}
      value={formData.adresse}
      onChangeText={text => setFormData({...formData, adresse: text})}
      placeholder="Adresse complète"
    />
    
    <View style={styles.grid}>
      <View style={styles.gridItem}>
        <Text style={styles.label}>Téléphone</Text>
        <TextInput
          style={styles.input}
          value={formData.telephone}
          onChangeText={handlePhoneChange}
          placeholder="514-783-2794"
          keyboardType="phone-pad"
          maxLength={12} // 3-3-4 + 2 tirets
        />
      </View>
      <View style={styles.gridItem}>
        <Text style={styles.label}>Courriel</Text>
        <TextInput
          style={styles.input}
          value={formData.courriel}
          onChangeText={text => setFormData({...formData, courriel: text})}
          placeholder="email@exemple.com"
          keyboardType="email-address"
        />
      </View>
    </View>
  </View>
)}

        {/* Section Dimensions de la toiture */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('dimensions')}>
          <FontAwesome5 name="ruler-combined" size={20} color="white" />
          <Text style={styles.sectionTitle}>Dimensions de la toiture</Text>
          <FontAwesome5 name={activeSection === 'dimensions' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'dimensions' && (
          <View style={[styles.sectionContent, styles.pickerSection]}>
            {formData.dimensions.map((section, index) => (
              <View key={`dim-section-${index}`} style={styles.dimSetContainer}>
                <View style={styles.sectionHeaderRow}>
                  <TextInput
                    style={styles.sectionNameInput}
                    value={section.name || `Section ${index + 1}`}
                    onChangeText={(text) => handleSectionNameChange(index, text)}
                    placeholder="Ex: Hangar"
                  />
                </View>
                
                <View style={styles.dimRow}>
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerLabel}>Longueur (pieds)</Text>
                    <TouchableOpacity 
                      style={styles.pickerTouchable}
                      onPress={() => openPicker(`length-${index}`)}
                    >
                      <Text style={styles.pickerValueText}>{section.length || "0"}</Text>
                      <RNPickerSelect
                        ref={el => pickerRefs.current[`length-${index}`] = el}
                        onValueChange={(value) => handleDimensionChange(index, 'length', value)}
                        items={generatePickerItems(0, 200)}
                        value={section.length}
                        style={pickerSelectStyles}
                        placeholder={{}}
                        useNativeAndroidPickerStyle={false}
                      />
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.multiply}>×</Text>
                  
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerLabel}>Largeur (pieds)</Text>
                    <TouchableOpacity 
                      style={styles.pickerTouchable}
                      onPress={() => openPicker(`width-${index}`)}
                    >
                      <Text style={styles.pickerValueText}>{section.width || "0"}</Text>
                      <RNPickerSelect
                        ref={el => pickerRefs.current[`width-${index}`] = el}
                        onValueChange={(value) => handleDimensionChange(index, 'width', value)}
                        items={generatePickerItems(0, 200)}
                        value={section.width}
                        style={pickerSelectStyles}
                        placeholder={{}}
                        useNativeAndroidPickerStyle={false}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {index > 0 && (
                  <TouchableOpacity
                    style={styles.removeSectionButton}
                    onPress={() => removeDimensionSection(index)}
                  >
                    <Text style={{color: '#e74c3c', fontSize: 14}}>❌</Text>
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
              <Text style={styles.totalSurfaceLabel}>Superficie totale (toiture + parapets):</Text>
              <Text style={styles.totalSurfaceValue}>{superficie.totale.toFixed(2)} pi²</Text>
            </View>
          </View>
        )}

        {/* Section Dimensions des parapets */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('parapets')}>
          <FontAwesome5 name="ruler-vertical" size={20} color="white" />
          <Text style={styles.sectionTitle}>Dimensions des parapets</Text>
          <FontAwesome5 name={activeSection === 'parapets' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'parapets' && (
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
                    <TouchableOpacity 
                      style={styles.pickerTouchable}
                      onPress={() => openPicker(`parapet-length-${index}`)}
                    >
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
                    <TouchableOpacity 
                      style={styles.pickerTouchable}
                      onPress={() => openPicker(`parapet-width-${index}`)}
                    >
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
                  <TouchableOpacity
                    style={styles.removeSectionButton}
                    onPress={() => removeParapetSection(index)}
                  >
                    <Text style={{color: '#e74c3c', fontSize: 14}}>❌</Text>
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
          <FontAwesome5 name={activeSection === 'materiaux' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'materiaux' && (
          <View style={[styles.sectionContent, styles.pickerSection]}>
            <View style={styles.materiauxGrid}>
              <View style={styles.materiauxItem}>
                <Text style={styles.label}>Feuilles de tôles</Text>
                <TouchableOpacity 
                  style={styles.pickerTouchable}
                  onPress={() => openPicker('nbFeuilles')}
                >
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
                <TouchableOpacity 
                  style={styles.pickerTouchable}
                  onPress={() => openPicker('nbMax')}
                >
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
                <TouchableOpacity 
                  style={styles.pickerTouchable}
                  onPress={() => openPicker('nbEvents')}
                >
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
                <TouchableOpacity 
                  style={styles.pickerTouchable}
                  onPress={() => openPicker('nbDrains')}
                >
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
                <TouchableOpacity 
                  style={styles.pickerTouchable}
                  onPress={() => openPicker('trepiedElectrique')}
                >
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
                      <TouchableOpacity 
                        style={[styles.pickerTouchable, { height: 45 }]}
                        onPress={() => openPicker(`puit-length-${index}`)}
                      >
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
                      <TouchableOpacity 
                        style={[styles.pickerTouchable, { height: 45 }]}
                        onPress={() => openPicker(`puit-width-${index}`)}
                      >
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
                    <TouchableOpacity
                      style={styles.removeSectionButton}
                      onPress={() => removePuitLumiere(index)}
                    >
                      <Text style={{color: '#e74c3c', fontSize: 14}}>❌</Text>
                      <Text style={styles.removeSectionButtonText}>Supprimer ce puit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View style={[styles.addSectionButtonContainer, { marginTop: 5 }]}>
                <TouchableOpacity
                  style={[styles.addSectionButton, { paddingVertical: 10 }]}
                  onPress={addPuitLumiere}
                >
                  <Text style={{color: '#3498db', fontSize: 16}}>➕</Text>
                  <Text style={styles.addSectionButtonText}>Ajouter un puit de lumière</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Section Photos */}
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('photos')}
        >
          <FontAwesome5 name="camera" size={20} color="white" />
          <Text style={styles.sectionTitle}>Photos du projet</Text>
          <FontAwesome5 name={activeSection === 'photos' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'photos' && (
          <View style={[styles.sectionContent, styles.nonPickerSection]}>
            <Text style={styles.photoNote}></Text>
            <View style={styles.photosContainer}>
              {photos.map(photo => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoItem}
                  onPress={() => setSelectedPhoto(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deletePhoto(photo.id)}
                  >
                    <Text style={{color: 'white', fontSize: 16}}>❌</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                style={styles.addPhoto} 
                onPress={openCustomCamera}
              >
                <Text style={{color: '#27ae60', fontSize: 32}}>+</Text>
                <Text style={[styles.addPhotoText, { color: '#27ae60', fontWeight: '600' }]}>Capture Instantanée</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Section Options */}
        <TouchableOpacity 
          style={styles.sectionHeader} 
          onPress={() => toggleSection('options')}
        >
          <FontAwesome5 name="cogs" size={20} color="white" />
          <Text style={styles.sectionTitle}>Autres options</Text>
          <FontAwesome5 name={activeSection === 'options' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'options' && (
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
        <TouchableOpacity 
          style={styles.sectionHeader} 
          onPress={() => toggleSection('notes')}
        >
          <FontAwesome5 name="sticky-note" size={20} color="white" />
          <Text style={styles.sectionTitle}>Notes supplémentaires</Text>
          <FontAwesome5 name={activeSection === 'notes' ? 'chevron-up' : 'chevron-down'} size={20} color="white" />
        </TouchableOpacity>
        
        {activeSection === 'notes' && (
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

        {/* Boutons avec Export Evernote */}
       <View style={styles.buttonContainer}>
        {/* Première ligne - Export Evernote seul */}
        <TouchableOpacity style={styles.evernoteButtonFull} onPress={handleEvernoteExport}>
          <FontAwesome5 name="file-export" size={18} color="white" />
          <Text style={styles.buttonText}>Export Evernote</Text>
          </TouchableOpacity>
         
          <View style={styles.secondRowButtons}>
          <TouchableOpacity style={styles.saveButton} onPress={enregistrerSoumission}>
            <FontAwesome5 name="save" size={18} color="white" />
            <Text style={styles.buttonText}>Enregistrer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.resetButton} onPress={resetForm}>
            <FontAwesome5 name="redo" size={18} color="#2c3e50" />
            <Text style={styles.resetButtonText}>Réinitialiser</Text>
          </TouchableOpacity>
           </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Caméra Custom Modal */}
      <CustomCamera
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onPhotoTaken={handlePhotoTaken}
      />

      {/* Modal pour afficher la photo sélectionnée */}
      {selectedPhoto && (
        <Modal visible={!!selectedPhoto} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setSelectedPhoto(null)}
            >
              <Text style={{color: 'white', fontSize: 30}}>❌</Text>
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
          <Text style={{color: 'white', fontSize: 20}}>
            {notification.type === 'success' ? '✅' : '⚠️'}
          </Text>
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
  pickerSection: {
    zIndex: 9999,
    elevation: 9999,
    position: 'relative',
  },
  nonPickerSection: {
    zIndex: 1,
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
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
  },
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    zIndex: 10000,
    elevation: 10000,
  },
  pickerContainer: {
    flex: 1,
    zIndex: 10001,
    elevation: 10001,
  },
  pickerTouchable: {
    height: 50,
    width: '100%',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'white',
    marginBottom: 15,
    zIndex: 10002,
    elevation: 10002,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4.65,
  },
  pickerValueText: {
    fontSize: 16,
    color: '#2d3436',
  },
  pickerLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  multiply: {
    fontWeight: 'bold',
    color: '#3498db',
    fontSize: 18,
    marginHorizontal: 5,
  },
  materiauxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    zIndex: 10000,
    elevation: 10000,
  },
  materiauxItem: {
    width: '48%',
    marginBottom: 15,
    zIndex: 10001,
    elevation: 10001,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  photoItem: {
    width: (Dimensions.get('window').width - 60) / 3,
    height: (Dimensions.get('window').width - 60) / 3,
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  addPhoto: {
    width: (Dimensions.get('window').width - 60) / 3,
    height: (Dimensions.get('window').width - 60) / 3,
    margin: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#27ae60',
    borderRadius: 8,
    borderStyle: 'solid',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
  },
  addPhotoText: {
    color: '#3498db',
    marginTop: 5,
    fontSize: 12,
    textAlign: 'center',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,

    padding: 5,
    borderTopLeftRadius: 5,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  checkboxLabel: {
    marginLeft: 10,
    color: '#333',
    fontSize: 15,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  buttonContainer: {
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
    flex: 0.48, // Prend 48% de la largeur
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
evernoteButtonFull: {
    flexDirection: 'row',
    backgroundColor: '#2dbe60',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10, // Espace entre les lignes
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
    // Conteneur pour la deuxième ligne
  secondRowButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    flex: 0.48, // Prend 48% de la largeur
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
    zIndex: 99999,
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
  photoNote: {
    color: '#27ae60',
    marginBottom: 10,
    fontWeight: '500',
  },
  dimSetContainer: {
    marginTop: 5,
    padding: 5,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 20,
    zIndex: 9998,
    elevation: 9998,
    position: 'relative',
  },
  addSectionButtonContainer: {
    width: '100%',
    marginTop: 5,
    marginBottom: 20,
  },
  addSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#3498db',
    borderRadius: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  addSectionButtonText: {
    color: '#3498db',
    marginLeft: 8,
    fontSize: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    marginRight: 10,
    backgroundColor: '#fff'
  },
  removeSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginTop: 5,
  },
  removeSectionButtonText: {
    color: '#e74c3c',
    marginLeft: 5,
    fontSize: 13,
  },
  totalSurfaceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#3498db',
  },
  totalSurfaceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  totalSurfaceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
  },
  dimSectionContainer: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 1,
    zIndex: 10000,
    elevation: 10000,
  },
  subSectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 1,
    marginHorizontal: 30,
  },

});

export default App;