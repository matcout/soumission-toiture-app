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
  Clipboard,
  Linking,
  Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

const NotesModal = ({ visible, onClose, project, onUpdateNotes }) => {
  const [editableNotes, setEditableNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (project?.notes) {
      setEditableNotes(project.notes);
    }
  }, [project]);

  // Fonction pour détecter et extraire les numéros de téléphone
  const detectPhoneNumbers = (text) => {
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    return text.match(phoneRegex) || [];
  };

  // Fonction pour copier du texte
  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert('✅ Copié', `"${text}" copié dans le presse-papiers`);
  };

  // Fonction pour appeler un numéro
  const callPhoneNumber = (phoneNumber) => {
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    Alert.alert(
      '📞 Appeler',
      `Voulez-vous appeler ${phoneNumber} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Appeler',
          onPress: () => {
            Linking.openURL(`tel:${cleanNumber}`);
          },
        },
        {
          text: 'Copier',
          onPress: () => copyToClipboard(phoneNumber),
        },
      ]
    );
  };

  // Sauvegarder les modifications
  const handleSaveNotes = async () => {
    try {
      await onUpdateNotes(project.id, editableNotes);
      setIsEditing(false);
      Alert.alert('✅ Sauvegardé', 'Notes mises à jour avec succès');
    } catch (error) {
      Alert.alert('❌ Erreur', 'Impossible de sauvegarder les notes');
    }
  };

  // Annuler les modifications
  const handleCancelEdit = () => {
    setEditableNotes(project?.notes || '');
    setIsEditing(false);
  };

  // Rendu du texte avec détection des numéros de téléphone
  const renderTextWithPhoneDetection = (text) => {
    const phoneNumbers = detectPhoneNumbers(text);
    
    if (phoneNumbers.length === 0) {
      return <Text style={styles.noteText}>{text}</Text>;
    }

    let lastIndex = 0;
    const elements = [];

    phoneNumbers.forEach((phone, index) => {
      const phoneIndex = text.indexOf(phone, lastIndex);
      
      // Texte avant le numéro
      if (phoneIndex > lastIndex) {
        elements.push(
          <Text key={`text-${index}`} style={styles.noteText}>
            {text.substring(lastIndex, phoneIndex)}
          </Text>
        );
      }

      // Numéro de téléphone cliquable
      elements.push(
        <TouchableOpacity
          key={`phone-${index}`}
          onPress={() => callPhoneNumber(phone)}
          style={styles.phoneNumber}
        >
          <Text style={styles.phoneNumberText}>{phone}</Text>
        </TouchableOpacity>
      );

      lastIndex = phoneIndex + phone.length;
    });

    // Texte après le dernier numéro
    if (lastIndex < text.length) {
      elements.push(
        <Text key="text-end" style={styles.noteText}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    return <View style={styles.textContainer}>{elements}</View>;
  };

  if (!project) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome5 name="arrow-left" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notes Supplémentaires</Text>
          <TouchableOpacity
            onPress={isEditing ? handleSaveNotes : () => setIsEditing(true)}
            style={styles.actionButton}
          >
            <FontAwesome5 
              name={isEditing ? "save" : "edit"} 
              size={18} 
              color="white" 
            />
          </TouchableOpacity>
        </View>

        {/* Contenu */}
        <ScrollView style={styles.content}>
          {/* Info projet */}
          <View style={styles.projectInfo}>
            <Text style={styles.projectAddress}>
              {project.client?.adresse || 'Adresse inconnue'}
            </Text>
            <Text style={styles.projectClient}>
              {project.client?.nom || 'Client inconnu'}
            </Text>
            <Text style={styles.projectStatus}>
              Statut: {project.status === 'assignment' ? 'à faire' : project.status}
            </Text>
          </View>

          {/* Section Notes */}
          <View style={styles.notesSection}>
            <View style={styles.notesSectionHeader}>
              <FontAwesome5 name="sticky-note" size={16} color="#3498db" />
              <Text style={styles.notesSectionTitle}>Instructions supplémentaires</Text>
            </View>

            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  value={editableNotes}
                  onChangeText={setEditableNotes}
                  multiline
                  numberOfLines={8}
                  placeholder="Ajoutez des instructions supplémentaires..."
                  textAlignVertical="top"
                />
                
                <View style={styles.editActions}>
                  <TouchableOpacity 
                    onPress={handleCancelEdit}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleSaveNotes}
                    style={styles.saveButton}
                  >
                    <FontAwesome5 name="save" size={14} color="white" />
                    <Text style={styles.saveButtonText}>Sauvegarder</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.readContainer}>
                {project.notes ? (
                  <>
                    {renderTextWithPhoneDetection(project.notes)}
                    
                    {/* Actions rapides - SANS "Copier tout" */}
                    <View style={styles.quickActions}>
                      <TouchableOpacity
                        onPress={() => setIsEditing(true)}
                        style={styles.quickActionButton}
                      >
                        <FontAwesome5 name="edit" size={14} color="#3498db" />
                        <Text style={styles.quickActionText}>Modifier</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <FontAwesome5 name="sticky-note" size={40} color="#bdc3c7" />
                    <Text style={styles.emptyStateText}>Aucune note disponible</Text>
                    <TouchableOpacity
                      onPress={() => setIsEditing(true)}
                      style={styles.addNoteButton}
                    >
                      <Text style={styles.addNoteButtonText}>+ Ajouter des notes</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Info sur les numéros détectés */}
          {project.notes && detectPhoneNumbers(project.notes).length > 0 && !isEditing && (
            <View style={styles.phoneInfo}>
              <FontAwesome5 name="info-circle" size={14} color="#f39c12" />
              <Text style={styles.phoneInfoText}>
                💡 Touchez les numéros en bleu pour appeler ou copier
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
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
  actionButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  projectInfo: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  projectAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  projectClient: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  projectStatus: {
    fontSize: 12,
    color: '#e67e22',
    fontWeight: '500',
  },
  notesSection: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  notesSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 8,
  },
  editContainer: {
    flex: 1,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 120,
    backgroundColor: '#f9f9f9',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  cancelButton: {
    flex: 0.45,
    backgroundColor: '#95a5a6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  saveButton: {
    flex: 0.45,
    backgroundColor: '#27ae60',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 5,
  },
  readContainer: {
    flex: 1,
  },
  textContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  noteText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2c3e50',
  },
  phoneNumber: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  phoneNumberText: {
    fontSize: 15,
    color: '#1976d2',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center', // Centré car un seul bouton
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  quickActionText: {
    marginLeft: 5,
    color: '#3498db',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    color: '#7f8c8d',
    fontSize: 16,
    marginTop: 10,
    marginBottom: 15,
  },
  addNoteButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addNoteButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  phoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  phoneInfoText: {
    marginLeft: 8,
    color: '#856404',
    fontSize: 12,
    flex: 1,
  },
});

export default NotesModal;