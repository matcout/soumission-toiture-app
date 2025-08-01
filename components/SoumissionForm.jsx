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
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FirebaseSync from '../firebaseSync';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import CustomCamera from '../CustomCamera';
import * as FileSystem from 'expo-file-system';
import { testFirebaseConnection } from '../firebase';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ImageViewer from 'react-native-image-zoom-viewer';

// Fonction de validation Firebase (empêche les erreurs undefined)
const validateFirebaseData = (data, path = '') => {
  const errors = [];
  
  const validate = (obj, currentPath) => {
    if (obj === undefined) {
      errors.push(`Valeur undefined trouvée à: ${currentPath}`);
      return null;
    }
    
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map((item, index) => validate(item, `${currentPath}[${index}]`));
    }
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      const cleanedValue = validate(value, newPath);
      
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    
    return cleaned;
  };
  
  const cleanedData = validate(data, path);
  
  if (errors.length > 0) {
    console.warn('🔧 Valeurs undefined nettoyées:', errors);
  }
  
  return cleanedData;
};

// Fonction pour créer une soumission sécurisée (sans undefined)
const createSafeSubmission = (formData, superficie, date, photos) => {
  const isExistingAssignment = Boolean(formData.isAssignment && formData.assignmentId);
  
  return {
    date: date.toISOString().split('T')[0],
    client: { 
      nom: String(formData.nom || ''), 
      adresse: String(formData.adresse || ''), 
      telephone: String(formData.telephone || ''), 
      courriel: String(formData.courriel || '') 
    },
    toiture: { 
      superficie: {
        toiture: Number(superficie?.toiture || 0),
        parapets: Number(superficie?.parapets || 0),
        totale: Number(superficie?.totale || 0)
      }, 
      plusieursEpaisseurs: Boolean(formData.plusieursEpaisseurs), 
      dimensions: Array.isArray(formData.dimensions) ? 
        formData.dimensions.map(dim => ({
          name: String(dim.name || ''),
          length: Number(dim.length || 0),
          width: Number(dim.width || 0)
        })) : []
    },
    parapets: Array.isArray(formData.parapets) ? 
      formData.parapets.map(parapet => ({
        name: String(parapet.name || ''),
        width: Number(parapet.width || 0),
        length: Number(parapet.length || 0)
      })) : [],
    materiel: { 
      nbFeuilles: Number(formData.nbFeuilles || 0), 
      nbDrains: Number(formData.nbDrains || 0), 
      nbEventsPlomberie: Number(formData.nbEventsPlomberie || 0),
      nbAerateurs: Number(formData.nbAerateurs || 0),
      nbTrepiedElectrique: Number(formData.nbTrepiedElectrique || 0),
      nbPuitsLumiere: Number(formData.puitsLumiere?.length || 0),
      puitsLumiere: Array.isArray(formData.puitsLumiere) ? 
        formData.puitsLumiere.map(puits => ({
          name: String(puits.name || ''),
          length: Number(puits.length || 0),
          width: Number(puits.width || 0)
        })) : []
    },
    accessoires: { 
      hydroQuebec: Boolean(formData.hydroQuebec), 
      grue: Boolean(formData.grue), 
      trackfall: Boolean(formData.trackfall) 
    },
    notes: String(formData.notes || ''),
    photos: photos,
    photoUrls: photos.map(p => p.firebaseUrl || p.localUri || p.uri).filter(Boolean),
    isAssignment: isExistingAssignment,
    assignmentId: isExistingAssignment ? String(formData.assignmentId || '') : null,
    status: 'captured',
    capturedAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
};

const SoumissionForm = ({ onReturn, prefilledData = null }) => {
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    courriel: '',
    dimensions: [{ length: 0, width: 0, name: '' }],
    parapets: [{ length: 0, width: 0, name: '' }],
    puitsLumiere: [],
    plusieursEpaisseurs: false,
    nbFeuilles: 0,
    nbDrains: 0,
    nbEventsPlomberie: 0,
    nbAerateurs: 0,
    nbTrepiedElectrique: 0,
    hydroQuebec: false,
    grue: false,
    trackfall: false,
    notes: '',
    isAssignment: false,
    assignmentId: null,
    // Nouveau: support pour sections multiples
    hasMultipleSections: false,
    currentSectionIndex: 0,
    sections: []
  });

  const [photos, setPhotos] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    status: 'preparing'
  });
  const [forceRefresh, setForceRefresh] = useState(0);

  // Effet pour charger les données préfillées
  useEffect(() => {
    if (prefilledData) {
      const loadPrefilledData = async () => {
        try {
          const cleanData = validateFirebaseData(prefilledData);
          
          setFormData({
            nom: cleanData.client?.nom || '',
            adresse: cleanData.client?.adresse || '',
            telephone: cleanData.client?.telephone || '',
            courriel: cleanData.client?.courriel || '',
            dimensions: cleanData.toiture?.dimensions?.length > 0 ? 
              cleanData.toiture.dimensions : [{ length: 0, width: 0, name: '' }],
            parapets: cleanData.parapets?.length > 0 ? 
              cleanData.parapets : [{ length: 0, width: 0, name: '' }],
            puitsLumiere: cleanData.materiel?.puitsLumiere || [],
            plusieursEpaisseurs: cleanData.toiture?.plusieursEpaisseurs || false,
            nbFeuilles: cleanData.materiel?.nbFeuilles || 0,
            nbDrains: cleanData.materiel?.nbDrains || 0,
            nbEventsPlomberie: cleanData.materiel?.nbEventsPlomberie || 0,
            nbAerateurs: cleanData.materiel?.nbAerateurs || 0,
            nbTrepiedElectrique: cleanData.materiel?.nbTrepiedElectrique || 0,
            hydroQuebec: cleanData.accessoires?.hydroQuebec || false,
            grue: cleanData.accessoires?.grue || false,
            trackfall: cleanData.accessoires?.trackfall || false,
            notes: cleanData.notes || '',
            isAssignment: true,
            assignmentId: cleanData.id,
            hasMultipleSections: false,
            currentSectionIndex: 0,
            sections: []
          });

          if (cleanData.photoUrls && cleanData.photoUrls.length > 0) {
            const photosWithUrls = cleanData.photoUrls.map((url, index) => ({
              id: `photo_${Date.now()}_${index}`,
              uri: url,
              firebaseUrl: url,
              isFromFirebase: true
            }));
            setPhotos(photosWithUrls);
          }
        } catch (error) {
          console.error('Erreur chargement données préremplies:', error);
        }
      };
      
      loadPrefilledData();
    }
  }, [prefilledData]);

  // Calculer superficie
  const superficie = {
    toiture: formData.dimensions.reduce((sum, dim) => sum + (dim.length * dim.width), 0),
    parapets: formData.parapets.reduce((sum, parapet) => sum + ((parapet.width / 12) * parapet.length), 0), // Convertir pouces en pieds
    totale: 0
  };
  superficie.totale = superficie.toiture + superficie.parapets;

  // Gérer changement de téléphone avec formatage
  const handlePhoneChange = (text) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    
    if (cleaned.length >= 6) {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    } else if (cleaned.length >= 3) {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }
    
    setFormData({...formData, telephone: formatted});
  };

  // Fonctions pour dimensions
  const handleDimensionChange = (sectionIndex, field, value) => {
    const newDimensions = [...formData.dimensions];
    newDimensions[sectionIndex][field] = Number(value) || 0;
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

  // Fonctions pour parapets
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

   /*Fonction pour créer une nouvelle section
  const createNewSection = () => {
    const currentSection = {
      sectionName: `Section ${formData.sections.length + 1}`,
      dimensions: formData.dimensions,
      parapets: formData.parapets,
      puitsLumiere: formData.puitsLumiere,
      plusieursEpaisseurs: formData.plusieursEpaisseurs,
      nbFeuilles: formData.nbFeuilles,
      nbDrains: formData.nbDrains,
      nbEventsPlomberie: formData.nbEventsPlomberie,
      nbAerateurs: formData.nbAerateurs,
      nbTrepiedElectrique: formData.nbTrepiedElectrique,
      hydroQuebec: formData.hydroQuebec,
      grue: formData.grue,
      trackfall: formData.trackfall,
      notes: formData.notes,
      photos: photos,
      superficie: superficie
    };

const handleSectionNameChange = (index, newName) => {
  const newSections = [...formData.sections];
  newSections[index] = {
    ...newSections[index],
    sectionName: newName
  };
  setFormData({
    ...formData,
    sections: newSections
  });
};

    // Sauvegarder la section actuelle
    const newSections = [...formData.sections];
    if (formData.currentSectionIndex < formData.sections.length) {
      newSections[formData.currentSectionIndex] = currentSection;
    } else {
      newSections.push(currentSection);
    }

    // Réinitialiser pour la nouvelle section mais garder les infos client
    setFormData({
      ...formData,
      dimensions: [{ length: 0, width: 0, name: '' }],
      parapets: [{ length: 0, width: 0, name: '' }],
      puitsLumiere: [],
      plusieursEpaisseurs: false,
      nbFeuilles: 0,
      nbDrains: 0,
      nbEventsPlomberie: 0,
      nbAerateurs: 0,
      nbTrepiedElectrique: 0,
      hydroQuebec: false,
      grue: false,
      trackfall: false,
      notes: '',
      hasMultipleSections: true,
      sections: newSections,
      currentSectionIndex: newSections.length
    });
    
    setPhotos([]);
    
    Alert.alert(
      'Nouvelle section créée',
      `Section ${newSections.length} sauvegardée. Vous pouvez maintenant ajouter la section ${newSections.length + 1}.`,
      [{ text: 'OK' }]
    );
  };*/

  // Fonction pour naviguer entre les sections
// CORRECTIONS POUR LES SECTIONS MULTIPLES

// 1. CORRIGER switchToSection pour TOUJOURS sauvegarder le nom actuel:
const switchToSection = (index) => {
  // Récupérer le nom actuel depuis le state (pas depuis sections)
  const currentSectionName = formData.sections[formData.currentSectionIndex]?.sectionName || '';
  
  // Sauvegarder la section actuelle avec TOUS ses données
  const currentSection = {
    sectionName: currentSectionName, // Utiliser le nom du state
    dimensions: formData.dimensions,
    parapets: formData.parapets,
    puitsLumiere: formData.puitsLumiere,
    plusieursEpaisseurs: formData.plusieursEpaisseurs,
    nbFeuilles: formData.nbFeuilles,
    nbDrains: formData.nbDrains,
    nbEventsPlomberie: formData.nbEventsPlomberie,
    nbAerateurs: formData.nbAerateurs,
    nbTrepiedElectrique: formData.nbTrepiedElectrique,
    hydroQuebec: formData.hydroQuebec,
    grue: formData.grue,
    trackfall: formData.trackfall,
    notes: formData.notes,
    photos: photos,
    superficie: superficie
  };

  // Créer une nouvelle copie des sections
  const newSections = [...formData.sections];
  newSections[formData.currentSectionIndex] = currentSection;

  // Charger la section demandée
  const sectionToLoad = newSections[index] || {};
  
  // Mettre à jour TOUT le state en une fois
  setFormData({
    ...formData,
    dimensions: sectionToLoad.dimensions || [{ length: 0, width: 0, name: '' }],
    parapets: sectionToLoad.parapets || [{ length: 0, width: 0, name: '' }],
    puitsLumiere: sectionToLoad.puitsLumiere || [],
    plusieursEpaisseurs: sectionToLoad.plusieursEpaisseurs || false,
    nbFeuilles: sectionToLoad.nbFeuilles || 0,
    nbDrains: sectionToLoad.nbDrains || 0,
    nbEventsPlomberie: sectionToLoad.nbEventsPlomberie || 0,
    nbAerateurs: sectionToLoad.nbAerateurs || 0,
    nbTrepiedElectrique: sectionToLoad.nbTrepiedElectrique || 0,
    hydroQuebec: sectionToLoad.hydroQuebec || false,
    grue: sectionToLoad.grue || false,
    trackfall: sectionToLoad.trackfall || false,
    notes: sectionToLoad.notes || '',
    sections: newSections, // Sections mises à jour avec la section actuelle sauvegardée
    currentSectionIndex: index
  });
  
  setPhotos(sectionToLoad.photos || []);
};

// 2. CORRIGER createNewSection de la même façon:
const createNewSection = () => {
  // Récupérer le nom actuel depuis le state
  const currentSectionName = formData.sections[formData.currentSectionIndex]?.sectionName || '';
  
  const currentSection = {
    sectionName: currentSectionName, // Utiliser le nom du state
    dimensions: formData.dimensions,
    parapets: formData.parapets,
    puitsLumiere: formData.puitsLumiere,
    plusieursEpaisseurs: formData.plusieursEpaisseurs,
    nbFeuilles: formData.nbFeuilles,
    nbDrains: formData.nbDrains,
    nbEventsPlomberie: formData.nbEventsPlomberie,
    nbAerateurs: formData.nbAerateurs,
    nbTrepiedElectrique: formData.nbTrepiedElectrique,
    hydroQuebec: formData.hydroQuebec,
    grue: formData.grue,
    trackfall: formData.trackfall,
    notes: formData.notes,
    photos: photos,
    superficie: superficie
  };

  // Sauvegarder la section actuelle
  const newSections = [...formData.sections];
  newSections[formData.currentSectionIndex] = currentSection;

  // Ajouter une nouvelle section vide
  const newSectionIndex = newSections.length;
  const newSection = {
    sectionName: '', // Nom vide pour la nouvelle section
    dimensions: [{ length: 0, width: 0, name: '' }],
    parapets: [{ length: 0, width: 0, name: '' }],
    puitsLumiere: [],
    plusieursEpaisseurs: false,
    nbFeuilles: 0,
    nbDrains: 0,
    nbEventsPlomberie: 0,
    nbAerateurs: 0,
    nbTrepiedElectrique: 0,
    hydroQuebec: false,
    grue: false,
    trackfall: false,
    notes: '',
    photos: [],
    superficie: { toiture: 0, parapets: 0, totale: 0 }
  };
  
  newSections.push(newSection);

  // Réinitialiser pour la nouvelle section
  setFormData({
    ...formData,
    dimensions: [{ length: 0, width: 0, name: '' }],
    parapets: [{ length: 0, width: 0, name: '' }],
    puitsLumiere: [],
    plusieursEpaisseurs: false,
    nbFeuilles: 0,
    nbDrains: 0,
    nbEventsPlomberie: 0,
    nbAerateurs: 0,
    nbTrepiedElectrique: 0,
    hydroQuebec: false,
    grue: false,
    trackfall: false,
    notes: '',
    hasMultipleSections: true,
    sections: newSections,
    currentSectionIndex: newSectionIndex
  });
  
  setPhotos([]);
  

};

// 3. CORRIGER handleSaveSubmission pour sauvegarder TOUTES les données correctement:
/*const handleSaveSubmission = async () => {
  try {
    // Validation
    if (!formData.adresse || formData.adresse.trim() === '') {
      showNotification('L\'adresse est requise', 'error');
      return;
    }

    setShowUploadModal(true);
    setUploadProgress({ current: 0, total: photos.length, status: 'uploading' });

    // Préparer les données de base
    const baseSubmission = {
      date: new Date().toISOString().split('T')[0],
      client: {
        nom: formData.nom || '',
        adresse: formData.adresse || '',
        telephone: formData.telephone || '',
        courriel: formData.courriel || ''
      },
      timestamp: Date.now(),
      status: prefilledData ? 'captured' : 'pending',
      capturedAt: Date.now()
    };

    // Si assignment prefilled
    if (prefilledData && prefilledData.id) {
      baseSubmission.id = prefilledData.id;
    }

    // Gérer les sections multiples
    if (formData.hasMultipleSections) {
      // D'ABORD sauvegarder la section actuelle avec son nom
      const currentSectionName = formData.sections[formData.currentSectionIndex]?.sectionName || '';
      
      const currentSection = {
        sectionName: currentSectionName,
        dimensions: formData.dimensions,
        parapets: formData.parapets,
        puitsLumiere: formData.puitsLumiere,
        plusieursEpaisseurs: formData.plusieursEpaisseurs,
        nbFeuilles: formData.nbFeuilles,
        nbDrains: formData.nbDrains,
        nbEventsPlomberie: formData.nbEventsPlomberie,
        nbAerateurs: formData.nbAerateurs,
        nbTrepiedElectrique: formData.nbTrepiedElectrique,
        hydroQuebec: formData.hydroQuebec,
        grue: formData.grue,
        trackfall: formData.trackfall,
        notes: formData.notes,
        photos: photos,
        superficie: superficie
      };
      
      // Mettre à jour toutes les sections
      const allSections = [...formData.sections];
      allSections[formData.currentSectionIndex] = currentSection;
      
      // Créer la soumission avec TOUTES les sections
      const submission = {
        ...baseSubmission,
        hasMultipleSections: true,
        sections: allSections,
        
        // Ajouter un résumé des sections
        superficiesParSection: allSections.map(s => ({
          sectionName: s.sectionName || `Section ${allSections.indexOf(s) + 1}`,
          toiture: s.superficie?.toiture || 0,
          parapets: s.superficie?.parapets || 0,
          totale: s.superficie?.totale || 0
        })),
        
        // Totaux globaux
        superficieTotaleGlobale: allSections.reduce((sum, s) => sum + (s.superficie?.totale || 0), 0),
        totalPhotos: allSections.reduce((sum, s) => sum + (s.photos?.length || 0), 0),
        
        // Pour compatibilité, ajouter les données de la première section au niveau racine
        toiture: allSections[0]?.dimensions ? {
          dimensions: allSections[0].dimensions,
          plusieursEpaisseurs: allSections[0].plusieursEpaisseurs,
          superficie: allSections[0].superficie
        } : {},
        parapets: allSections[0]?.parapets || [],
        materiel: {
          nbFeuilles: allSections[0]?.nbFeuilles || 0,
          nbDrains: allSections[0]?.nbDrains || 0,
          nbEventsPlomberie: allSections[0]?.nbEventsPlomberie || 0,
          nbAerateurs: allSections[0]?.nbAerateurs || 0,
          nbTrepiedElectrique: allSections[0]?.nbTrepiedElectrique || 0,
          puitsLumiere: allSections[0]?.puitsLumiere || []
        },
        accessoires: {
          hydroQuebec: allSections[0]?.hydroQuebec || false,
          grue: allSections[0]?.grue || false,
          trackfall: allSections[0]?.trackfall || false
        },
        notes: allSections.map(s => s.notes).filter(n => n).join('\n---\n') || '',
        photos: allSections.flatMap(s => s.photos || [])
      };
      
      // Sauvegarder
      if (prefilledData && prefilledData.id) {
        await FirebaseSync.updateSubmission(prefilledData.id, submission);
      } else {
        await FirebaseSync.createSubmission(submission, 'mobile');
      }
      
    } else {
      // Projet simple sans sections
      const safeSoumission = createSafeSubmission(formData, superficie, new Date(), photos);
      const submission = {
        ...baseSubmission,
        ...safeSoumission
      };
      
      if (prefilledData && prefilledData.id) {
        await FirebaseSync.updateSubmission(prefilledData.id, submission);
      } else {
        await FirebaseSync.createSubmission(submission, 'mobile');
      }
    }

    setUploadProgress(prev => ({ ...prev, status: 'completed' }));

    setTimeout(() => {
      setShowUploadModal(false);
      showNotification('Soumission enregistrée avec succès!', 'success');
      setTimeout(() => {
        onReturn();
      }, 1500);
    }, 1000);
    
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
    setShowUploadModal(false);
    showNotification('Erreur lors de la sauvegarde', 'error');
  }
};*/

  // Gérer les photos
  const handlePhotoTaken = (photo) => {
    setPhotos([...photos, photo]);
  };

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
          }
        }
      ]
    );
  };

  const viewPhoto = (index) => {
    setCurrentImageIndex(index);
    setShowImageViewer(true);
  };

  const openCustomCamera = () => {
    setShowCamera(true);
  };

  // Gestion des puits de lumière
  const addPuitLumiere = () => {
    setFormData({ ...formData, puitsLumiere: [...formData.puitsLumiere, { length: 0, width: 0, name: '' }] });
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
    newPuits[index][field] = Number(value) || 0;
    setFormData({...formData, puitsLumiere: newPuits});
  };

  // Sauvegarder la soumission
const handleSaveSubmission = async () => {
  try {
    // Validation
    if (!formData.adresse || formData.adresse.trim() === '') {
      showNotification('L\'adresse est requise', 'error');
      return;
    }

    setShowUploadModal(true);
    setUploadProgress({ current: 0, total: photos.length, status: 'uploading' });

    // 📸 ÉTAPE 1: Créer d'abord la soumission pour obtenir l'ID
    const tempSubmissionData = {
      date: new Date().toISOString().split('T')[0],
      client: {
        nom: formData.nom || '',
        adresse: formData.adresse || '',
        telephone: formData.telephone || '',
        courriel: formData.courriel || ''
      },
      timestamp: Date.now(),
      status: prefilledData ? 'captured' : 'pending',
      platform: 'mobile'
    };

    let submissionId;
    
    // Si c'est une mise à jour d'assignment
    if (prefilledData && prefilledData.id) {
      submissionId = prefilledData.id;
    } else {
      // Créer une nouvelle soumission temporaire pour obtenir l'ID
      const createResult = await FirebaseSync.createSubmission(tempSubmissionData, 'mobile');
      if (!createResult.success) {
        throw new Error('Erreur lors de la création de la soumission');
      }
      submissionId = createResult.id;
    }

    // 📸 ÉTAPE 2: Uploader les photos sur Firebase Storage
    let uploadedPhotos = [];
    
    if (photos.length > 0) {
      console.log(`📤 Upload de ${photos.length} photos sur Firebase...`);
      
      const uploadResult = await FirebaseSync.uploadPhotos(
        submissionId, 
        photos,
        (progress) => {
          setUploadProgress({
            current: progress.currentPhoto,
            total: progress.totalPhotos,
            percentage: progress.percentage,
            status: progress.status || 'uploading'
          });
        }
      );

      if (!uploadResult.success && uploadResult.errors.length === photos.length) {
        throw new Error('Échec de l\'upload de toutes les photos');
      }

      // Transformer les URLs en format compatible
      uploadedPhotos = uploadResult.uploadedUrls.map((url, index) => ({
        id: photos[index]?.id || `photo_${index}`,
        uri: url, // URL Firebase au lieu du chemin local
        url: url, // Ajouter aussi dans 'url' pour compatibilité
        downloadURL: url, // Et dans 'downloadURL' pour être sûr
        timestamp: photos[index]?.timestamp || new Date().toISOString()
      }));

      console.log(`✅ ${uploadedPhotos.length} photos uploadées sur Firebase`);
    }

    // 📝 ÉTAPE 3: Préparer les données complètes avec les URLs Firebase
    setUploadProgress({ current: photos.length, total: photos.length, status: 'saving' });

    // IMPORTANT: Sauvegarder la section actuelle AVANT tout si multi-sections
    if (formData.hasMultipleSections) {
      const currentSectionName = formData.sections[formData.currentSectionIndex]?.sectionName ?? '';
      
      const currentSection = {
        sectionName: currentSectionName,
        dimensions: formData.dimensions,
        parapets: formData.parapets,
        puitsLumiere: formData.puitsLumiere,
        plusieursEpaisseurs: formData.plusieursEpaisseurs,
        nbFeuilles: formData.nbFeuilles,
        nbDrains: formData.nbDrains,
        nbEventsPlomberie: formData.nbEventsPlomberie,
        nbAerateurs: formData.nbAerateurs,
        nbTrepiedElectrique: formData.nbTrepiedElectrique,
        hydroQuebec: formData.hydroQuebec,
        grue: formData.grue,
        trackfall: formData.trackfall,
        notes: formData.notes,
        photos: uploadedPhotos, // Utiliser les photos uploadées
        superficie: superficie
      };
      
      // Mettre à jour formData.sections AVANT de continuer
      formData.sections[formData.currentSectionIndex] = currentSection;
    }

    // Préparer la soumission finale
    const safeSoumission = createSafeSubmission(formData, superficie, new Date(), uploadedPhotos);
    
    // 📤 ÉTAPE 4: Mettre à jour la soumission avec toutes les données
    if (prefilledData && prefilledData.id) {
      // Mise à jour d'un assignment existant
      await FirebaseSync.updateSubmission(prefilledData.id, {
        ...safeSoumission,
        status: 'captured',
        capturedAt: Date.now(),
        photos: uploadedPhotos // S'assurer que les photos uploadées sont incluses
      });
    } else {
      // Mise à jour de la soumission créée avec toutes les données
      
      // CODE POUR SECTIONS MULTIPLES
      if (formData.hasMultipleSections) {
        // Traiter toutes les sections pour remplacer les photos locales par les URLs Firebase
        const allSectionsWithFirebasePhotos = formData.sections.map((section, sectionIndex) => {
          // Pour la section courante, on a déjà les photos uploadées
          if (sectionIndex === formData.currentSectionIndex) {
            return {
              ...section,
              photos: uploadedPhotos
            };
          }
          
          // Pour les autres sections, garder leurs photos existantes
          // (elles devraient déjà avoir des URLs Firebase si elles ont été sauvegardées avant)
          return section;
        });
        
        // Ajouter toutes les sections à la soumission
        safeSoumission.hasMultipleSections = true;
        safeSoumission.sections = allSectionsWithFirebasePhotos;
        
        // Logs pour débugger
        console.log('SECTIONS À SAUVEGARDER:', allSectionsWithFirebasePhotos);
        console.log('NOMBRE DE SECTIONS:', allSectionsWithFirebasePhotos.length);
        
        // Résumé des superficies
        safeSoumission.superficiesParSection = allSectionsWithFirebasePhotos.reduce((acc, s, index) => {
          acc[s.sectionName || `Section ${index + 1}`] = {
            sectionName: s.sectionName || `Section ${index + 1}`,
            toiture: s.superficie?.toiture || 0,
            parapets: s.superficie?.parapets || 0,
            totale: s.superficie?.totale || 0
          };
          return acc;
        }, {});
        
        // Total global
        safeSoumission.superficieTotaleGlobale = allSectionsWithFirebasePhotos.reduce((sum, s) => sum + (s.superficie?.totale || 0), 0);
        safeSoumission.totalPhotos = allSectionsWithFirebasePhotos.reduce((sum, s) => sum + (s.photos?.length || 0), 0);
      } else {
        // Projet simple : s'assurer que les photos uploadées sont incluses
        safeSoumission.photos = uploadedPhotos;
      }
      
      // Mettre à jour la soumission avec toutes les données
      await FirebaseSync.updateSubmission(submissionId, safeSoumission);
    }

    setUploadProgress(prev => ({ ...prev, status: 'completed' }));

    setTimeout(() => {
      setShowUploadModal(false);
      showNotification('Soumission enregistrée avec succès!', 'success');
      setTimeout(() => {
        onReturn();
      }, 1500);
    }, 1000);
    
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
    setShowUploadModal(false);
    showNotification(error.message || 'Erreur lors de la sauvegarde', 'error');
  }
};

  // Réinitialiser le formulaire
  const resetForm = () => {
    setFormData({
      nom: '',
      adresse: '',
      telephone: '',
      courriel: '',
      dimensions: [{ length: 0, width: 0, name: '' }],
      parapets: [{ length: 0, width: 0, name: '' }],
      puitsLumiere: [],
      plusieursEpaisseurs: false,
      nbFeuilles: 0,
      nbDrains: 0,
      nbEventsPlomberie: 0,
      nbAerateurs: 0,
      nbTrepiedElectrique: 0,
      hydroQuebec: false,
      grue: false,
      trackfall: false,
      notes: '',
      isAssignment: false,
      assignmentId: null,
      hasMultipleSections: false,
      currentSectionIndex: 0,
      sections: []
    });
    setPhotos([]);
  };

  // Notification
  const showNotification = (message, type) => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification({ ...notification, visible: false }), 3000);
  };

  // Fonction de fermeture avec force refresh
  const handleCameraClose = () => {
    console.log('📸 Fermeture caméra appelée');
    // D'abord, on cache le modal
    setShowCamera(false);
    // Ensuite, on force un délai pour s'assurer que tout est nettoyé
    setTimeout(() => {
      setForceRefresh(prev => prev + 1);
      console.log('✅ Caméra complètement fermée');
    }, 500); // Délai plus long pour être sûr
  };

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

const updateCurrentSectionName = (newName) => {
  const newSections = [...formData.sections];
  if (newSections[formData.currentSectionIndex]) {
    newSections[formData.currentSectionIndex] = {
      ...newSections[formData.currentSectionIndex],
      sectionName: newName  // Gardez newName même si c'est ''
    };
    setFormData({
      ...formData,
      sections: newSections
    });
  }
};

  return (
    <View style={styles.container}>
      <FormHeader />
      
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
          
      {/* Section pour projets complexes avec multiples sections */}
<View style={styles.sectionWrapper}>
  <Text style={styles.compactSectionTitle}>
    <FontAwesome5 name="layer-group" size={14} color="#2c3e50" /> Gestion des sections
  </Text>
  
  <View style={styles.compactSectionContent}>
    {!formData.hasMultipleSections ? (
      <TouchableOpacity 
        style={styles.multiSectionButton} 
        onPress={() => {
          Alert.alert(
            'Projet avec sections multiples',
            'Voulez-vous diviser ce projet en plusieurs sections distinctes ? Chaque section aura ses propres dimensions, photos et matériaux.',
            [
              { text: 'Annuler', style: 'cancel' },
              { 
                text: 'Activer', 
                onPress: () => {
                  setFormData({
                    ...formData,
                    hasMultipleSections: true,
                    sections: [{
                      sectionName: 'Section 1',
                      dimensions: formData.dimensions,
                      parapets: formData.parapets,
                      puitsLumiere: formData.puitsLumiere,
                      plusieursEpaisseurs: formData.plusieursEpaisseurs,
                      nbFeuilles: formData.nbFeuilles,
                      nbDrains: formData.nbDrains,
                      nbEventsPlomberie: formData.nbEventsPlomberie,
                      nbAerateurs: formData.nbAerateurs,
                      nbTrepiedElectrique: formData.nbTrepiedElectrique,
                      hydroQuebec: formData.hydroQuebec,
                      grue: formData.grue,
                      trackfall: formData.trackfall,
                      notes: formData.notes,
                      photos: photos,
                      superficie: superficie
                    }],
                    currentSectionIndex: 0
                  });
                }
              }
            ]
          );
        }}
      >
        <FontAwesome5 name="layer-group" size={18} color="#3498db" />
        <Text style={styles.multiSectionButtonText}>
          Activer les sections multiples (projets complexes)
        </Text>
      </TouchableOpacity>
    ) : (
      <View>
        {/* Champ pour le nom de la section actuelle */}
        <View style={styles.sectionNameContainer}>
          <Text style={styles.sectionNameLabel}>Nom de la section:</Text>
       <TextInput
  style={styles.sectionNameInput}
  value={formData.sections[formData.currentSectionIndex]?.sectionName ?? ''}  // Utilisez ?? au lieu de ||
  onChangeText={updateCurrentSectionName}
  placeholder={`Section ${formData.currentSectionIndex + 1}`}
  placeholderTextColor="#95a5a6"
/>
        </View>
        
        {/* Sélecteur de section */}
        <View style={styles.sectionSelector}>
          <Text style={styles.sectionSelectorTitle}>Naviguer entre les sections:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sectionTabs}>
              {formData.sections.map((section, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.sectionTab,
                    formData.currentSectionIndex === index && styles.activeTab
                  ]}
                  onPress={() => switchToSection(index)}
                >
                  <Text style={[
                    styles.sectionTabText,
                    formData.currentSectionIndex === index && styles.activeTabText
                  ]}>
                    {section.sectionName || `Section ${index + 1}`}
                  </Text>
                  <Text style={styles.sectionTabInfo}>
                    {section.photos?.length || 0} photos
                  </Text>
                  <Text style={styles.sectionTabInfo}>
                    {(section.superficie?.totale || 0).toFixed(0)} pi²
                  </Text>
                </TouchableOpacity>
              ))}
              
              {/* Bouton nouvelle section */}
              <TouchableOpacity
                style={[styles.sectionTab, styles.newSectionTab]}
                onPress={createNewSection}
              >
                <FontAwesome5 name="plus" size={16} color="#3498db" />
                <Text style={styles.newSectionTabText}>Nouvelle</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
        
        {/* Résumé des sections */}
        <View style={styles.sectionSummary}>
          <Text style={styles.sectionSummaryText}>
            Total: {formData.sections.length} section(s)
          </Text>
          <Text style={styles.sectionSummaryText}>
            Photos totales: {formData.sections.reduce((sum, s) => sum + (s.photos?.length || 0), 0) + photos.length}
          </Text>
          <Text style={styles.sectionSummaryText}>
            Superficie section actuelle: {superficie.totale.toFixed(2)} pi²
          </Text>
        </View>
      </View>
    )}
  </View>
</View>

          {/* Section Informations client - Plus compacte */}
          <View style={styles.sectionWrapper}>
            <Text style={styles.compactSectionTitle}>
              <FontAwesome5 name="user" size={14} color="#2c3e50" /> Informations client
            </Text>
            
            <View style={styles.compactSectionContent}>
              <View style={styles.inputGroup}>
                <TextInput 
                  style={styles.compactInput} 
                  value={formData.nom} 
                  onChangeText={text => setFormData({...formData, nom: text})} 
                  placeholder="Nom du client"
                  placeholderTextColor="#95a5a6"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <TextInput 
                  style={[styles.compactInput, styles.requiredInput]} 
                  value={formData.adresse} 
                  onChangeText={text => setFormData({...formData, adresse: text})} 
                  placeholder="Adresse des travaux *"
                  placeholderTextColor="#95a5a6"
                />
              </View>
              
              <View style={styles.gridRow}>
                <View style={styles.halfWidth}>
                  <View style={styles.phoneContainer}>
                    <TextInput 
                      style={[styles.compactInput, styles.phoneInput]} 
                      value={formData.telephone} 
                      onChangeText={handlePhoneChange} 
                      placeholder="Téléphone" 
                      keyboardType="phone-pad" 
                      maxLength={12}
                      placeholderTextColor="#95a5a6"
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
                
                <View style={styles.halfWidth}>
                  <TextInput 
                    style={styles.compactInput} 
                    value={formData.courriel} 
                    onChangeText={text => setFormData({...formData, courriel: text})} 
                    placeholder="Courriel" 
                    keyboardType="email-address"
                    placeholderTextColor="#95a5a6"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Section Dimensions - Plus compacte */}
          <View style={styles.sectionWrapper}>
            <Text style={styles.compactSectionTitle}>
              <FontAwesome5 name="ruler-combined" size={14} color="#2c3e50" /> Dimensions de la toiture
            </Text>
            
            <View style={styles.compactSectionContent}>
              {formData.dimensions.map((section, index) => (
                <View key={`dim-${index}`} style={styles.dimensionItem}>
                  <TextInput 
                    style={styles.dimensionNameInput} 
                    value={section.name} 
                    onChangeText={(text) => handleSectionNameChange(index, text)} 
                    placeholder={`Section ${index + 1}`}
                    placeholderTextColor="#95a5a6"
                  />
                  
                  <View style={styles.dimensionInputs}>
                    <TextInput
                      style={styles.dimensionNumberInput}
                      value={section.length === 0 ? '' : section.length.toString()}
                      onChangeText={(value) => handleDimensionChange(index, 'length', value)}
                      keyboardType="numeric"
                      placeholder="L"
                      placeholderTextColor="#95a5a6"
                    />
                    
                    <Text style={styles.dimensionX}>×</Text>
                    
                    <TextInput
                      style={styles.dimensionNumberInput}
                      value={section.width === 0 ? '' : section.width.toString()}
                      onChangeText={(value) => handleDimensionChange(index, 'width', value)}
                      keyboardType="numeric"
                      placeholder="l"
                      placeholderTextColor="#95a5a6"
                    />
                    
                    <Text style={styles.dimensionUnit}>pi²</Text>
                    
                    {index > 0 && (
                      <TouchableOpacity onPress={() => removeDimensionSection(index)}>
                        <FontAwesome5 name="times-circle" size={18} color="#e74c3c" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              
              <TouchableOpacity style={styles.compactAddButton} onPress={addDimensionSection}>
                <FontAwesome5 name="plus-circle" size={16} color="#3498db" />
                <Text style={styles.compactAddButtonText}>Ajouter une section</Text>
              </TouchableOpacity>
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total toiture (Section {formData.hasMultipleSections ? formData.currentSectionIndex + 1 : ''}):</Text>
                <Text style={styles.totalValue}>{superficie.toiture.toFixed(2)} pi²</Text>
              </View>
            </View>
          </View>

          {/* Section Parapets - Plus compacte avec largeur en pouces */}
          <View style={styles.sectionWrapper}>
            <Text style={styles.compactSectionTitle}>
              <FontAwesome5 name="ruler-vertical" size={14} color="#2c3e50" /> Parapets
            </Text>
            
            <View style={styles.compactSectionContent}>
              {formData.parapets.map((parapet, index) => (
                <View key={`parapet-${index}`} style={styles.dimensionItem}>
                  <TextInput 
                    style={styles.dimensionNameInput} 
                    value={parapet.name} 
                    onChangeText={(text) => {
                      const newParapets = [...formData.parapets];
                      newParapets[index].name = text;
                      setFormData({...formData, parapets: newParapets});
                    }} 
                    placeholder={`Parapet ${index + 1}`}
                    placeholderTextColor="#95a5a6"
                  />
                  
                  <View style={styles.dimensionInputs}>
                    <TextInput
                      style={styles.dimensionNumberInput}
                      value={parapet.width === 0 ? '' : parapet.width.toString()}
                      onChangeText={(value) => {
                        const newParapets = [...formData.parapets];
                        newParapets[index].width = Number(value) || 0;
                        setFormData({...formData, parapets: newParapets});
                      }}
                      keyboardType="numeric"
                      placeholder="L (po)"
                      placeholderTextColor="#95a5a6"
                    />
                    
                    <Text style={styles.dimensionX}>×</Text>
                    
                    <TextInput
                      style={styles.dimensionNumberInput}
                      value={parapet.length === 0 ? '' : parapet.length.toString()}
                      onChangeText={(value) => {
                        const newParapets = [...formData.parapets];
                        newParapets[index].length = Number(value) || 0;
                        setFormData({...formData, parapets: newParapets});
                      }}
                      keyboardType="numeric"
                      placeholder="L (pi)"
                      placeholderTextColor="#95a5a6"
                    />
                    
                    <Text style={styles.dimensionUnit}>pi²</Text>
                    
                    {index > 0 && (
                      <TouchableOpacity onPress={() => removeParapetSection(index)}>
                        <FontAwesome5 name="times-circle" size={18} color="#e74c3c" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              
              <TouchableOpacity style={styles.compactAddButton} onPress={addParapetSection}>
                <FontAwesome5 name="plus-circle" size={16} color="#3498db" />
                <Text style={styles.compactAddButtonText}>Ajouter un parapet</Text>
              </TouchableOpacity>
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total parapets (Section {formData.hasMultipleSections ? formData.currentSectionIndex + 1 : ''}):</Text>
                <Text style={styles.totalValue}>{superficie.parapets.toFixed(2)} pi²</Text>
              </View>
            </View>
          </View>

          {/* Section Matériaux - Style original avec pickerSection */}
          <View style={styles.sectionWrapper}>
            <Text style={styles.compactSectionTitle}>
              <FontAwesome5 name="tools" size={14} color="#2c3e50" /> Matériaux et accessoires
            </Text>
            
            <View style={[styles.compactSectionContent, styles.pickerSection]}>
              <View style={styles.materiauxGrid}>
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Feuilles de tôles</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={formData.nbFeuilles === 0 ? '' : formData.nbFeuilles.toString()}
                    onChangeText={text => setFormData({...formData, nbFeuilles: Number(text) || 0})}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Drains</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={formData.nbDrains === 0 ? '' : formData.nbDrains.toString()}
                    onChangeText={text => setFormData({...formData, nbDrains: Number(text) || 0})}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Évents</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={formData.nbEventsPlomberie === 0 ? '' : formData.nbEventsPlomberie.toString()}
                    onChangeText={text => setFormData({...formData, nbEventsPlomberie: Number(text) || 0})}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Optimum</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={formData.nbAerateurs === 0 ? '' : formData.nbAerateurs.toString()}
                    onChangeText={text => setFormData({...formData, nbAerateurs: Number(text) || 0})}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                
                <View style={styles.materiauxItem}>
                  <Text style={styles.label}>Trépied électrique</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={formData.nbTrepiedElectrique === 0 ? '' : formData.nbTrepiedElectrique.toString()}
                    onChangeText={text => setFormData({...formData, nbTrepiedElectrique: Number(text) || 0})}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </View>

              {/* Section Puits de lumière */}
              <View style={styles.puitsLumiereSection}>
                <Text style={styles.subSectionHeader}>Puits de lumière</Text>
                
                {formData.puitsLumiere.map((puits, index) => (
                  <View key={`puits-${index}`} style={styles.dimSetContainer}>
                    <View style={styles.sectionHeaderRow}>
                      <TextInput 
                        style={styles.sectionNameInput} 
                        value={puits.name} 
                        onChangeText={(text) => {
                          const newPuits = [...formData.puitsLumiere];
                          newPuits[index].name = text;
                          setFormData({...formData, puitsLumiere: newPuits});
                        }} 
                        placeholder={`Puits ${index + 1}`} 
                      />
                    </View>
                    
                    <View style={styles.dimRow}>
                      <View style={styles.pickerContainer}>
                        <Text style={styles.pickerLabel}>Largeur (pouces)</Text>
                        <TextInput
                          style={styles.numberInput}
                          value={puits.width === 0 ? '' : puits.width.toString()}
                          onChangeText={(value) => handlePuitLumiereChange(index, 'width', value)}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                      
                      <Text style={styles.multiply}>×</Text>
                      
                      <View style={styles.pickerContainer}>
                        <Text style={styles.pickerLabel}>Longueur (pouces)</Text>
                        <TextInput
                          style={styles.numberInput}
                          value={puits.length === 0 ? '' : puits.length.toString()}
                          onChangeText={(value) => handlePuitLumiereChange(index, 'length', value)}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                    </View>
                    
                    {index > 0 && (
                      <TouchableOpacity style={styles.removeSectionButton} onPress={() => removePuitLumiere(index)}>
                        <Text style={styles.deleteX}>✕</Text>
                        <Text style={styles.removeSectionButtonText}>Supprimer ce puits</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <View style={styles.addSectionButtonContainer}>
                  <TouchableOpacity style={styles.addSectionButton} onPress={addPuitLumiere}>
                    <Text style={{color: '#3498db', fontSize: 16}}>➕</Text>
                    <Text style={styles.addSectionButtonText}>Ajouter un puits de lumière</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Section Options - Checkboxes compactes */}
          <View style={styles.sectionWrapper}>
            <Text style={styles.compactSectionTitle}>
              <FontAwesome5 name="check-square" size={14} color="#2c3e50" /> Options spéciales
            </Text>
            
            <View style={styles.compactSectionContent}>
              <View style={styles.checkboxGrid}>
                <TouchableOpacity 
                  style={styles.compactCheckbox} 
                  onPress={() => setFormData({...formData, plusieursEpaisseurs: !formData.plusieursEpaisseurs})}
                >
                  <FontAwesome5 
                    name={formData.plusieursEpaisseurs ? "check-square" : "square"} 
                    size={18} 
                    color="#3498db" 
                  />
                  <Text style={styles.compactCheckboxLabel}>Plusieurs épaisseurs</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.compactCheckbox} 
                  onPress={() => setFormData({...formData, hydroQuebec: !formData.hydroQuebec})}
                >
                  <FontAwesome5 
                    name={formData.hydroQuebec ? "check-square" : "square"} 
                    size={18} 
                    color="#3498db" 
                  />
                  <Text style={styles.compactCheckboxLabel}>Hydro Québec</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.compactCheckbox} 
                  onPress={() => setFormData({...formData, grue: !formData.grue})}
                >
                  <FontAwesome5 
                    name={formData.grue ? "check-square" : "square"} 
                    size={18} 
                    color="#3498db" 
                  />
                  <Text style={styles.compactCheckboxLabel}>Grue nécessaire</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.compactCheckbox} 
                  onPress={() => setFormData({...formData, trackfall: !formData.trackfall})}
                >
                  <FontAwesome5 
                    name={formData.trackfall ? "check-square" : "square"} 
                    size={18} 
                    color="#3498db" 
                  />
                  <Text style={styles.compactCheckboxLabel}>Trackfall</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section Notes - Plus compacte */}
          <View style={styles.sectionWrapper}>
            <Text style={styles.compactSectionTitle}>
              <FontAwesome5 name="sticky-note" size={14} color="#2c3e50" /> Notes
            </Text>
            
            <View style={styles.compactSectionContent}>
              <TextInput
                style={styles.compactNotesInput}
                multiline
                numberOfLines={3}
                value={formData.notes}
                onChangeText={text => setFormData({...formData, notes: text})}
                placeholder="Informations supplémentaires..."
                placeholderTextColor="#95a5a6"
              />
            </View>
          </View>

          {/* Section Photos - Reste similaire mais avec header compact */}
          <View style={styles.sectionWrapper}>
            <Text style={styles.compactSectionTitle}>
              <FontAwesome5 name="camera" size={14} color="#2c3e50" /> Photos ({photos.length})
            </Text>
            
            <View style={styles.compactSectionContent}>
              <View style={styles.photoGrid}>
                <TouchableOpacity style={styles.addPhotoButton} onPress={openCustomCamera}>
                  <FontAwesome5 name="camera" size={24} color="#3498db" />
                  <Text style={styles.addPhotoText}>Ajouter photo</Text>
                </TouchableOpacity>
                
                {photos.map((photo, index) => (
                  <TouchableOpacity 
                    key={photo.id} 
                    style={styles.photoItem}
                    onPress={() => viewPhoto(index)}
                    onLongPress={() => deletePhoto(photo.id)}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                    <View style={styles.photoOverlay}>
                      <Text style={styles.photoNumber}>{index + 1}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Boutons d'action */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.mainSaveButton} onPress={handleSaveSubmission}>
              <FontAwesome5 name="save" size={20} color="white" />
              <Text style={styles.buttonText}>Enregistrer</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.resetButton} onPress={resetForm}>
              <FontAwesome5 name="undo" size={20} color="#2c3e50" />
              <Text style={styles.resetButtonText}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Camera avec key unique pour forcer le démontage */}
      {showCamera && (
        <Modal
          key={`camera-${forceRefresh}`}
          animationType="slide"
          transparent={false}
          visible={true}
          onRequestClose={handleCameraClose}
        >
          <CustomCamera
            visible={true}
            onPhotoTaken={handlePhotoTaken}
            onClose={handleCameraClose}
          />
        </Modal>
      )}

      {/* Modal Visualiseur d'images */}
      <Modal visible={showImageViewer} transparent={true} onRequestClose={() => setShowImageViewer(false)}>
        <ImageViewer
          imageUrls={photos.map(photo => ({ url: photo.uri }))}
          index={currentImageIndex}
          onSwipeDown={() => setShowImageViewer(false)}
          enableSwipeDown={true}
          backgroundColor="rgba(0,0,0,0.95)"
          renderIndicator={(currentIndex, allSize) => (
            <View style={styles.imageIndicator}>
              <Text style={styles.imageIndicatorText}>{currentIndex}/{allSize}</Text>
            </View>
          )}
        />
        <TouchableOpacity
          style={styles.closeImageViewer}
          onPress={() => setShowImageViewer(false)}
        >
          <FontAwesome5 name="times" size={28} color="white" />
        </TouchableOpacity>
      </Modal>

      {/* Modal Upload */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showUploadModal}
        onRequestClose={() => {}}
      >
        <View style={styles.uploadModalOverlay}>
          <View style={styles.uploadModalContent}>
            <Text style={styles.uploadTitle}>
              {uploadProgress.status === 'completed' ? 'Terminé!' : 'Sauvegarde en cours...'}
            </Text>
            
            {uploadProgress.status === 'uploading' && (
              <>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${uploadProgress.percentage}%` }
                    ]} 
                  />
                </View>
                
                <Text style={styles.progressText}>
                  {uploadProgress.current}/{uploadProgress.total} photos uploadées
                </Text>
                
                <Text style={styles.progressPercentage}>
                  {uploadProgress.percentage}%
                </Text>
                
                <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 20 }} />
              </>
            )}
            
            {uploadProgress.status === 'completed' && (
              <View style={styles.successContainer}>
                <FontAwesome5 name="check-circle" size={60} color="#27ae60" />
                <Text style={styles.successText}>Soumission enregistrée!</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Notification */}
      {notification.visible && (
        <View style={[
          styles.notification,
          notification.type === 'success' ? styles.successNotification : styles.errorNotification
        ]}>
          <FontAwesome5 
            name={notification.type === 'success' ? 'check-circle' : 'exclamation-circle'} 
            size={20} 
            color="white" 
          />
          <Text style={styles.notificationText}>{notification.message}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Styles existants à conserver
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  scrollContainer: { flex: 1 },
  formHeader: { backgroundColor: '#3498db', paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 20, paddingHorizontal: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backText: { color: 'white', marginLeft: 10, fontSize: 16 },
  headerContent: { marginLeft: 30 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 5 },

  // Nouveaux styles compacts
  sectionWrapper: {
    backgroundColor: 'white',
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  
  compactSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50', // Couleur plus foncée
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  
  compactSectionContent: {
    padding: 15,
  },
  
  inputGroup: {
    marginBottom: 12,
  },
  
  compactInput: {
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f8f9fa',
  },
  
  requiredInput: {
    borderColor: '#e74c3c',
  },
  
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  
  halfWidth: {
    flex: 1,
  },
  
  phoneContainer: {
    position: 'relative',
  },
  
  phoneInput: {
    paddingRight: 40,
  },
  
  callButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    bottom: 8,
    width: 30,
    backgroundColor: '#27ae60',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Styles pour dimensions
  dimensionItem: {
    marginBottom: 10,
  },
  
  dimensionNameInput: {
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    fontSize: 14,
    backgroundColor: '#f8f9fa',
  },
  
  dimensionInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  dimensionNumberInput: {
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 6,
    padding: 8,
    width: 60,
    textAlign: 'center',
    fontSize: 14,
    backgroundColor: '#f8f9fa',
  },
  
  dimensionX: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  
  dimensionUnit: {
    fontSize: 14,
    color: '#7f8c8d',
    marginRight: 10,
  },
  
  compactAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#3498db',
    borderRadius: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.05)',
  },
  
  compactAddButtonText: {
    color: '#3498db',
    marginLeft: 6,
    fontSize: 14,
  },
  
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
  },
  
  // Styles pour matériaux - STYLES ORIGINAUX
  materiauxGrid: {
    marginBottom: 15,
  },
  
  materiauxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  
  label: {
    fontSize: 15,
    color: '#2c3e50',
    flex: 1,
  },
  
  numberInput: {
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    padding: 10,
    width: 80,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: 'white',
  },
  
  pickerSection: {
    paddingHorizontal: 5,
  },
  
  pickerContainer: {
    flex: 1,
    marginHorizontal: 5,
  },
  
  pickerLabel: {
    fontSize: 13,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  
  multiply: {
    fontSize: 20,
    color: '#95a5a6',
    marginHorizontal: 5,
  },
  
  // Styles pour puits de lumière
  puitsLumiereSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  
  subSectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
  },
  
dimSetContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  
  sectionHeaderRow: {
    marginBottom: 10,
  },
  
  sectionNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    backgroundColor: '#fff',
  },
  
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  
  removeSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginTop: 5,
  },
  
  deleteX: {
    color: '#e74c3c',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  removeSectionButtonText: {
    color: '#e74c3c',
    marginLeft: 5,
    fontSize: 13,
  },
  
  // Styles pour checkboxes
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  
  compactCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
  },
  
  compactCheckboxLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2c3e50',
  },
  
  // Styles pour notes
  compactNotesInput: {
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f8f9fa',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  
  // Styles pour photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  
  addPhotoButton: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: '#3498db',
    borderRadius: 8,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.05)',
  },
  
  addPhotoText: {
    color: '#3498db',
    fontSize: 12,
    marginTop: 5,
  },
  
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  
  photoImage: {
    width: '100%',
    height: '100%',
  },
  
  photoOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  photoNumber: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Styles pour boutons
  buttonContainer: {
    marginHorizontal: 10,
    marginTop: 20,
    marginBottom: 30,
  },
  
  mainSaveButton: {
    flexDirection: 'row',
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  resetButton: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ecf0f1',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  
  
  // Gardez tous les autres styles existants pour les modals, notifications, etc.
  imageIndicator: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  
  imageIndicatorText: {
    color: 'white',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  
  closeImageViewer: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
  },
  
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  uploadModalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 30,
    width: '85%',
    alignItems: 'center',
  },
  
  uploadTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  
  progressBar: {
    width: '100%',
    height: 10,
    backgroundColor: '#ecf0f1',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
  },
  
  progressText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  
  progressPercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
    marginTop: 10,
  },
  
  successContainer: {
    alignItems: 'center',
  },
  
  successText: {
    fontSize: 18,
    color: '#27ae60',
    marginTop: 15,
    fontWeight: '600',
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
  
  // Styles pour sections multiples
  multiSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderWidth: 2,
    borderColor: '#3498db',
    borderRadius: 10,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  
  multiSectionButtonText: {
    color: '#3498db',
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  
  sectionSelector: {
    marginBottom: 15,
  },
  
  sectionSelectorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  
  sectionTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  
  sectionTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ecf0f1',
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  
  activeTab: {
    backgroundColor: '#3498db',
  },
  
  sectionTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  
  activeTabText: {
    color: 'white',
  },
  
  sectionTabInfo: {
    fontSize: 11,
    color: '#95a5a6',
    marginTop: 2,
  },
  
  newSectionTab: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#3498db',
    borderStyle: 'dashed',
  },
  
  newSectionTabText: {
    color: '#3498db',
    fontSize: 13,
    marginTop: 2,
  },
  
  sectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  
  sectionSummaryText: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  sectionNameContainer: {
  marginBottom: 15,
  backgroundColor: '#f8f9fa',
  padding: 12,
  borderRadius: 8,
},

sectionNameLabel: {
  fontSize: 13,
  color: '#7f8c8d',
  marginBottom: 5,
},

sectionNameInput: {
  borderWidth: 1,
  borderColor: '#ecf0f1',
  borderRadius: 5,
  paddingHorizontal: 12,
  paddingVertical: 8,
  fontSize: 15,
  backgroundColor: '#fff',
  color: '#2c3e50',
},
});

export default SoumissionForm;