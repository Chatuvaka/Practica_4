import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { router } from "expo-router";

import { supabase } from "../lib/supabase";

type Announcement = {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

export default function AdminScreen() {
  const [announcements, setAnnouncements] =
    useState<Announcement[]>([]);

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    verifyAdmin();

    const channel = supabase
      .channel(
        "admin-announcements"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "announcements",
        },
        () => {
          loadAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  async function verifyAdmin() {
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    const { data, error } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (
      error ||
      !data ||
      data.role !== "admin"
    ) {
      Alert.alert(
        "Acceso denegado",
        "Tu cuenta no tiene permisos de administrador."
      );

      router.replace("/home");

      return;
    }

    await loadAnnouncements();
  }

  async function loadAnnouncements() {
    const { data, error } =
      await supabase
        .from("announcements")
        .select(
          "id, title, description, active, created_at"
        )
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      console.error(
        "Error cargando avisos:",
        error
      );

      return;
    }

    setAnnouncements(
      (data ?? []) as Announcement[]
    );
  }

  async function createAnnouncement() {
    if (!title.trim()) {
      Alert.alert(
        "Título requerido",
        "Escribe un título para el aviso."
      );

      return;
    }

    try {
      setLoading(true);

      const { error } =
        await supabase
          .from("announcements")
          .insert({
            title: title.trim(),

            description:
              description.trim() ||
              null,

            active: true,
          });

      if (error) {
        Alert.alert(
          "Error",
          error.message
        );

        return;
      }

      setTitle("");
      setDescription("");

      Alert.alert(
        "Aviso creado",
        "El aviso se publicó correctamente."
      );

      await loadAnnouncements();
    } finally {
      setLoading(false);
    }
  }

  async function toggleAnnouncement(
    announcement: Announcement
  ) {
    const { error } =
      await supabase
        .from("announcements")
        .update({
          active:
            !announcement.active,
        })
        .eq(
          "id",
          announcement.id
        );

    if (error) {
      Alert.alert(
        "Error",
        error.message
      );

      return;
    }

    await loadAnnouncements();
  }

  function confirmDelete(
    announcement: Announcement
  ) {
    Alert.alert(
      "Eliminar aviso",
      `¿Deseas eliminar "${announcement.title}"?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },

        {
          text: "Eliminar",
          style: "destructive",

          onPress: () =>
            deleteAnnouncement(
              announcement.id
            ),
        },
      ]
    );
  }

  async function deleteAnnouncement(
    id: string
  ) {
    const { error } =
      await supabase
        .from("announcements")
        .delete()
        .eq("id", id);

    if (error) {
      Alert.alert(
        "Error",
        error.message
      );

      return;
    }

    await loadAnnouncements();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Panel administrativo
          </Text>

          <Text style={styles.subtitle}>
            Administración del sistema
          </Text>
        </View>

        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.replace(
              "/home"
            )
          }
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            Volver
          </Text>
        </Pressable>
      </View>

      <View style={styles.menu}>
        <Pressable
          style={styles.menuCard}
          onPress={() =>
            router.push(
              "/admin-attendance"
            )
          }
        >
          <Text
            style={styles.menuTitle}
          >
            Historial de asistencias
          </Text>

          <Text
            style={
              styles.menuDescription
            }
          >
            Consulta entradas,
            salidas, fechas y horas.
          </Text>
        </Pressable>

        <Pressable
          style={styles.menuCard}
          onPress={() =>
            router.push(
              "/admin-users"
            )
          }
        >
          <Text
            style={styles.menuTitle}
          >
            Usuarios
          </Text>

          <Text
            style={
              styles.menuDescription
            }
          >
            Consulta los usuarios
            registrados en el
            sistema.
          </Text>
        </Pressable>
      </View>

      <View style={styles.createCard}>
        <Text
          style={styles.sectionTitle}
        >
          Crear nuevo aviso
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Título del aviso"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={[
            styles.input,
            styles.descriptionInput,
          ]}
          placeholder="Descripción"
          multiline
          value={description}
          onChangeText={
            setDescription
          }
        />

        <Pressable
          style={[
            styles.createButton,
            loading &&
              styles.disabledButton,
          ]}
          disabled={loading}
          onPress={
            createAnnouncement
          }
        >
          <Text
            style={
              styles.createButtonText
            }
          >
            {loading
              ? "Publicando..."
              : "Publicar aviso"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        Avisos publicados
      </Text>

      <FlatList
        data={announcements}
        keyExtractor={(item) =>
          item.id
        }
        contentContainerStyle={
          styles.list
        }
        ListEmptyComponent={
          <Text
            style={styles.emptyText}
          >
            No hay avisos
            registrados.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={
              styles.announcementCard
            }
          >
            <View
              style={
                styles.cardHeader
              }
            >
              <View
                style={
                  styles.cardContent
                }
              >
                <Text
                  style={
                    styles.announcementTitle
                  }
                >
                  {item.title}
                </Text>

                {!!item.description && (
                  <Text
                    style={
                      styles.announcementDescription
                    }
                  >
                    {
                      item.description
                    }
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.statusBadge,

                  !item.active &&
                    styles.inactiveBadge,
                ]}
              >
                <Text
                  style={
                    styles.statusText
                  }
                >
                  {item.active
                    ? "ACTIVO"
                    : "INACTIVO"}
                </Text>
              </View>
            </View>

            <View
              style={styles.actions}
            >
              <Pressable
                style={
                  styles.secondaryButton
                }
                onPress={() =>
                  toggleAnnouncement(
                    item
                  )
                }
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  {item.active
                    ? "Desactivar"
                    : "Activar"}
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.deleteButton
                }
                onPress={() =>
                  confirmDelete(item)
                }
              >
                <Text
                  style={
                    styles.deleteText
                  }
                >
                  Eliminar
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: "#f5f5f5",
    },

    header: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 20,
    },

    title: {
      fontSize: 28,
      fontWeight: "800",
    },

    subtitle: {
      marginTop: 4,
      fontSize: 15,
      color: "#666666",
    },

    backButton: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      backgroundColor: "#dddddd",
      borderRadius: 10,
    },

    backButtonText: {
      fontWeight: "600",
    },

    menu: {
      gap: 12,
      marginBottom: 24,
    },

    menuCard: {
      backgroundColor: "#222222",
      padding: 18,
      borderRadius: 14,
    },

    menuTitle: {
      color: "#ffffff",
      fontSize: 18,
      fontWeight: "700",
    },

    menuDescription: {
      color: "#cccccc",
      marginTop: 5,
      lineHeight: 20,
    },

    createCard: {
      backgroundColor: "#ffffff",
      borderRadius: 16,
      padding: 20,
      marginBottom: 28,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 14,
    },

    input: {
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      backgroundColor: "#ffffff",
      fontSize: 16,
    },

    descriptionInput: {
      minHeight: 90,
      textAlignVertical: "top",
    },

    createButton: {
      backgroundColor: "#111111",
      borderRadius: 10,
      padding: 15,
      alignItems: "center",
    },

    createButtonText: {
      color: "#ffffff",
      fontWeight: "700",
      fontSize: 16,
    },

    disabledButton: {
      opacity: 0.5,
    },

    list: {
      paddingBottom: 40,
    },

    announcementCard: {
      backgroundColor: "#ffffff",
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
    },

    cardHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "flex-start",
    },

    cardContent: {
      flex: 1,
      paddingRight: 12,
    },

    announcementTitle: {
      fontSize: 18,
      fontWeight: "700",
    },

    announcementDescription: {
      marginTop: 7,
      color: "#555555",
      lineHeight: 21,
    },

    statusBadge: {
      backgroundColor: "#dddddd",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },

    inactiveBadge: {
      opacity: 0.5,
    },

    statusText: {
      fontSize: 11,
      fontWeight: "700",
    },

    actions: {
      flexDirection: "row",
      marginTop: 18,
      gap: 10,
    },

    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 10,
      padding: 12,
      alignItems: "center",
    },

    secondaryButtonText: {
      fontWeight: "600",
    },

    deleteButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: "#eeeeee",
    },

    deleteText: {
      fontWeight: "600",
    },

    emptyText: {
      textAlign: "center",
      color: "#666666",
      marginTop: 20,
    },
  });