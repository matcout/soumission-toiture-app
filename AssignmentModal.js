// AssignmentModal.js - Version mobile avec support d'édition

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

const AssignmentModal = ({ visible, onClose, onSubmit, initialData = null, isEditMode = false }) => {
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    courriel: '',
    notes: ''
  });

  // Charger les données initiales si on est en mode édition
  useEffect(() => {
    if (visible && initialData && isEditMode) {
      setFormData({
        nom: initialData.client?.nom || '',
        adresse: initialData.client?.adresse || initialData.displayName || '',
        telephone: initialData.client?.telephone || '',
        courriel: initialData.client?.courriel || '',
        notes: initialData.notes || ''
      });
    } else if (visible && !isEditMode) {
      // Réinitialiser pour un nouvel assignment
      setFormData({
        nom: '',
        adresse: '',
        telephone: '',
        courriel: '',
        notes: ''
      });
    }
  }, [visible, initialData, isEditMode]);

  const handleSubmit = () => {
    if (!formData.adresse.trim()) {
      Alert.alert('⚠️ Adresse requise', 'Veuillez entrer une adresse pour continuer');
      return;
    }

    if (isEditMode && initialData) {
      // Mode édition : passer l'objet complet mis à jour
      const updatedAssignment = {
        ...initialData,
        client: {
          nom: formData.nom,
          adresse: formData.adresse.trim(),
          telephone: formData.telephone,
          courriel: formData.courriel
        },
        notes: formData.notes,
        displayName: formData.adresse.trim(),
        updatedAt: Date.now()
      };
      
      onSubmit(updatedAssignment, true); // true = mode édition
    } else {
      // Mode création : format normal
      onSubmit({
        client: {
          nom: formData.nom,
          adresse: formData.adresse.trim(),
          telephone: formData.telephone,
          courriel: formData.courriel
        },
        notes: formData.notes || 'Assignment créé depuis l\'app mobile - À compléter sur le terrain'
      }, false); // false = mode création
    }
    
    // Reset form
    handleClose();
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Format téléphone automatiquement
  const handlePhoneChange = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 10);
    
    if (limited.length >= 6) {
      const formatted = `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
      handleInputChange('telephone', formatted);
    } else if (limited.length >= 3) {
      const formatted = `${limited.slice(0, 3)}-${limited.slice(3)}`;
      handleInputChange('telephone', formatted);
    } else {
      handleInputChange('telephone', limited);
    }
  };

  // Reset form when modal closes
  const handleClose = () => {
    setFormData({
      nom: '',
      adresse: '',
      telephone: '',
      courriel: '',
      notes: ''
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <FontAwesome5 name="times" size={20} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Modifier l\'assignment' : 'Nouvelle Soumission'}
            </Text>
            <TouchableOpacity onPress={handleSubmit} style={styles.saveButton}>
              <FontAwesome5 name="check" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* ScrollView pour le contenu */}
          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Section Info */}
            <View style={[styles.infoSection, isEditMode && styles.infoSectionEdit]}>
              <FontAwesome5 
                name={isEditMode ? "edit" : "info-circle"} 
                size={40} 
                color={isEditMode ? "#ff9800" : "#1976d2"} 
              />
              <Text style={[styles.infoTitle, isEditMode && styles.infoTitleEdit]}>
                {isEditMode ? 'Modifier l\'assignment' : 'Nouvelle soumission'}
              </Text>
              <Text style={[styles.infoSubtitle, isEditMode && styles.infoSubtitleEdit]}>
                {isEditMode 
                  ? 'Modifiez les informations ci-dessous' 
                  : 'Job à aller voir'}
              </Text>
            </View>

            {/* Formulaire */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Informations client</Text>
              
              {/* Nom du client */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nom du client</Text>
                <TextInput
                  style={styles.input}
                  value={formData.nom}
                  onChangeText={(value) => handleInputChange('nom', value)}
                  placeholder="Nom complet du client"
                  placeholderTextColor="#9e9e9e"
                />
              </View>

              {/* Adresse */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, styles.requiredLabel]}>
                  Adresse des travaux *
                </Text>
                <TextInput
                  style={[styles.input, styles.requiredInput]}
                  value={formData.adresse}
                  onChangeText={(value) => handleInputChange('adresse', value)}
                  placeholder="Adresse complète du projet"
                  placeholderTextColor="#9e9e9e"
                />
              </View>

              {/* Groupe téléphone et courriel */}
              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Téléphone</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.telephone}
                    onChangeText={handlePhoneChange}
                    placeholder="514-123-4567"
                    placeholderTextColor="#9e9e9e"
                    keyboardType="phone-pad"
                    maxLength={12}
                  />
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.label}>Courriel</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.courriel}
                    onChangeText={(value) => handleInputChange('courriel', value)}
                    placeholder="email@exemple.com"
                    placeholderTextColor="#9e9e9e"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Notes spéciales */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Instructions pour l'équipe terrain</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(value) => handleInputChange('notes', value)}
                  placeholder="Détails importants, accès au toit, horaires préférés, contraintes spéciales..."
                  placeholderTextColor="#9e9e9e"
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

            
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  header: {
    backgroundColor: '#2c3e50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  infoSection: {
    backgroundColor: '#e3f2fd',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  infoSectionEdit: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffb74d',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginTop: 10,
    marginBottom: 5,
    textAlign: 'center',
  },
  infoTitleEdit: {
    color: '#f57c00',
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#1565c0',
    textAlign: 'center',
    lineHeight: 20,
  },
  infoSubtitleEdit: {
    color: '#e65100',
  },
  formSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    paddingBottom: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  requiredLabel: {
    color: '#dc2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#1f2937',
  },
  requiredInput: {
    borderColor: '#dc2626',
    borderWidth: 2,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  halfInput: {
    width: '48%',
  },
  warningSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  warningText: {
    marginLeft: 10,
    color: '#856404',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});

export default AssignmentModal;