// Remplacez votre AssignmentModal.js par cette version corrigée :

import React, { useState } from 'react';
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
  KeyboardAvoidingView,  // AJOUT IMPORTANT
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

const AssignmentModal = ({ visible, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    courriel: '',
    notes: ''
  });

  const handleSubmit = () => {
    if (!formData.adresse.trim()) {
      Alert.alert('⚠️ Adresse requise', 'Veuillez entrer une adresse pour créer l\'assignment');
      return;
    }

    // Appeler la fonction de soumission
    onSubmit({
      client: {
        nom: formData.nom,
        adresse: formData.adresse.trim(),
        telephone: formData.telephone,
        courriel: formData.courriel
      },
      notes: formData.notes || 'Assignment créé depuis l\'app mobile - À compléter sur le terrain'
    });
    
    // Reset form
    setFormData({
      nom: '',
      adresse: '',
      telephone: '',
      courriel: '',
      notes: ''
    });
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
        {/* AJOUT IMPORTANT : KeyboardAvoidingView pour gérer le clavier */}
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header - reste en haut */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <FontAwesome5 name="times" size={20} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nouvelle Soumission</Text>
            <TouchableOpacity onPress={handleSubmit} style={styles.saveButton}>
              <FontAwesome5 name="check" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* ScrollView pour permettre le défilement quand le clavier est ouvert */}
          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Section Info */}
            <View style={styles.infoSection}>
              <FontAwesome5 name="info-circle" size={40} color="#1976d2" />
              <Text style={styles.infoTitle}>Nouvelle soumission</Text>
              <Text style={styles.infoSubtitle}>
                Job a aller voir 
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
                  onChangeText={(text) => handleInputChange('nom', text)}
                  placeholder="Nom complet"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {/* Adresse - OBLIGATOIRE */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, styles.requiredLabel]}>
                  Adresse des travaux *
                </Text>
                <TextInput
                  style={[styles.input, styles.requiredInput]}
                  value={formData.adresse}
                  onChangeText={(text) => handleInputChange('adresse', text)}
                  placeholder="Adresse complète (obligatoire)"
                  placeholderTextColor="#dc2626"
                />
              </View>

              {/* Téléphone et Courriel */}
              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Téléphone</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.telephone}
                    onChangeText={handlePhoneChange}
                    placeholder="514-123-4567"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    maxLength={12}
                  />
                </View>
                
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Courriel</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.courriel}
                    onChangeText={(text) => handleInputChange('courriel', text)}
                    placeholder="email@exemple.com"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Notes spéciales - LE CHAMP PROBLÉMATIQUE */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes additionnelles</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => handleInputChange('notes', text)}
                  placeholder="Instructions spéciales, accès, contraintes, horaires..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

         
            </View>

            {/* Espace supplémentaire en bas pour le clavier */}
            <View style={{ height: 50 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#3498db',
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
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginTop: 10,
    marginBottom: 5,
    textAlign: 'center',
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#1565c0',
    textAlign: 'center',
    lineHeight: 20,
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