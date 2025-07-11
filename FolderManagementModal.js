// FolderManagementModal.js - Version Mobile React Native
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { AVAILABLE_FOLDER_COLORS, AVAILABLE_FOLDER_ICONS_MOBILE } from './folderSyncFunctions';

export default function FolderManagementModal({ 
  visible, 
  onClose, 
  onSave, 
  folder = null, 
  parentFolder = null 
}) {
  const [formData, setFormData] = useState({
    label: '',
    icon: 'folder',
    color: '#3b82f6'
  });

  useEffect(() => {
    if (folder) {
      setFormData({
        label: folder.label,
        icon: folder.icon || 'folder',
        color: folder.color || '#3b82f6'
      });
    } else {
      setFormData({
        label: '',
        icon: 'folder',
        color: '#3b82f6'
      });
    }
  }, [folder, visible]);

  const handleSubmit = () => {
    if (!formData.label.trim()) {
      return;
    }

    onSave({
      ...formData,
      id: folder?.id,
      parentId: parentFolder?.id || null,
      parentLabel: parentFolder?.label || null
    });

    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {folder ? 'Modifier le dossier' : 
               parentFolder ? `Sous-dossier de "${parentFolder.label}"` : 
               'Nouveau dossier'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome5 name="times" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Nom du dossier */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom du dossier</Text>
              <TextInput
                style={styles.textInput}
                value={formData.label}
                onChangeText={(text) => setFormData({ ...formData, label: text })}
                placeholder={parentFolder ? "Ex: Urgent" : "Ex: Projets Spéciaux"}
                autoFocus
              />
            </View>

            {/* Sélection d'icône */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Icône</Text>
              <View style={styles.iconGrid}>
                {AVAILABLE_FOLDER_ICONS_MOBILE.map(iconName => (
                  <TouchableOpacity
                    key={iconName}
                    style={[
                      styles.iconButton,
                      formData.icon === iconName && styles.iconButtonSelected
                    ]}
                    onPress={() => setFormData({ ...formData, icon: iconName })}
                  >
                    <FontAwesome5 
                      name={iconName} 
                      size={20} 
                      color={formData.icon === iconName ? '#3b82f6' : '#666'} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sélection de couleur */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Couleur</Text>
              <View style={styles.colorGrid}>
                {AVAILABLE_FOLDER_COLORS.map(color => (
                  <TouchableOpacity
                    key={color.name}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color.hex },
                      formData.color === color.hex && styles.colorButtonSelected
                    ]}
                    onPress={() => setFormData({ ...formData, color: color.hex })}
                  >
                    {formData.color === color.hex && (
                      <FontAwesome5 name="check" size={16} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button, 
                styles.saveButton,
                !formData.label.trim() && styles.buttonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!formData.label.trim()}
            >
              <Text style={styles.saveButtonText}>
                {folder ? 'Modifier' : 'Créer'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  iconButton: {
    width: 50,
    height: 50,
    margin: 5,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  iconButtonSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#e3f2fd',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  colorButton: {
    width: 50,
    height: 50,
    margin: 5,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: '#2c3e50',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    marginLeft: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});