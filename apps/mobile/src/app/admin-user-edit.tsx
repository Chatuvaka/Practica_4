import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import { supabase } from "../lib/supabase";

type UserRole =
  | "user"
  | "admin"
  | "display";

export default function AdminUserEditScreen() {
  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const userId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [name, setName] =
    useState("");

  const [
    employeeNumber,
    setEmployeeNumber,
  ] = useState("");

  const [role, setRole] =
    useState<UserRole>("user");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    verifyAndLoad();
  }, []);

  async function verifyAndLoad() {
    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      const {
        data: adminProfile,
        error: adminError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (
        adminError ||
        !adminProfile ||
        adminProfile.role !== "admin"
      ) {
        Alert.alert(
          "Acceso denegado",
          "No tienes permisos de administrador."
        );

        router.replace("/home");
        return;
      }

      if (!userId) {
        Alert.alert(
          "Usuario inválido",
          "No se recibió un usuario válido."
        );

        router.back();
        return;
      }

      const {
        data: profile,
        error,
      } = await supabase
        .from("profiles")
        .select(
          "name, employee_number, role"
        )
        .eq("id", userId)
        .single();

      if (error || !profile) {
        Alert.alert(
          "Error",
          error?.message ??
            "No se encontró el usuario."
        );

        router.back();
        return;
      }

      setName(profile.name ?? "");

      setEmployeeNumber(
        profile.employee_number ?? ""
      );

      setRole(
        profile.role as UserRole
      );
    } catch (error) {
      console.error(
        "Error cargando usuario:",
        error
      );

      Alert.alert(
        "Error",
        "No fue posible cargar el usuario."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveChanges() {
    if (!name.trim()) {
      Alert.alert(
        "Nombre requerido",
        "El usuario debe tener un nombre."
      );

      return;
    }

    try {
      setSaving(true);

      const { error } =
        await supabase
          .from("profiles")
          .update({
            name: name.trim(),

            employee_number:
              employeeNumber.trim() ||
              null,

            role,
          })
          .eq("id", userId);

      if (error) {
        Alert.alert(
          "Error",
          error.message
        );

        return;
      }

      Alert.alert(
        "Usuario actualizado",
        "Los cambios fueron guardados correctamente.",
        [
          {
            text: "Aceptar",

            onPress: () =>
              router.back(),
          },
        ]
      );
    } catch (error) {
      console.error(
        "Error actualizando usuario:",
        error
      );

      Alert.alert(
        "Error",
        "No fue posible guardar los cambios."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
        />

        <Text
          style={styles.loadingText}
        >
          Cargando usuario...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Editar usuario
          </Text>

          <Text
            style={styles.subtitle}
          >
            Información del perfil
          </Text>
        </View>

        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.back()
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

      <View style={styles.card}>
        <Text style={styles.label}>
          Nombre completo
        </Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nombre completo"
        />

        <Text style={styles.label}>
          Matrícula / Número de empleado
        </Text>

        <TextInput
          style={styles.input}
          value={employeeNumber}
          onChangeText={
            setEmployeeNumber
          }
          placeholder="Ej. 20260001"
        />

        <Text style={styles.label}>
          Rol
        </Text>

        <View
          style={
            styles.roleContainer
          }
        >
          <Pressable
            style={[
              styles.roleButton,

              role === "user" &&
                styles.roleSelected,
            ]}
            onPress={() =>
              setRole("user")
            }
          >
            <Text
              style={[
                styles.roleText,

                role === "user" &&
                  styles.roleSelectedText,
              ]}
            >
              Usuario
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.roleButton,

              role === "admin" &&
                styles.roleSelected,
            ]}
            onPress={() =>
              setRole("admin")
            }
          >
            <Text
              style={[
                styles.roleText,

                role === "admin" &&
                  styles.roleSelectedText,
              ]}
            >
              Admin
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.roleButton,

              role === "display" &&
                styles.roleSelected,
            ]}
            onPress={() =>
              setRole("display")
            }
          >
            <Text
              style={[
                styles.roleText,

                role ===
                  "display" &&
                  styles.roleSelectedText,
              ]}
            >
              Display
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.saveButton,

            saving &&
              styles.disabledButton,
          ]}
          disabled={saving}
          onPress={saveChanges}
        >
          <Text
            style={styles.saveText}
          >
            {saving
              ? "Guardando..."
              : "Guardar cambios"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#f5f5f5",
      padding: 20,
    },

    loading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#f5f5f5",
    },

    loadingText: {
      marginTop: 14,
      fontSize: 16,
    },

    header: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 24,
    },

    title: {
      fontSize: 28,
      fontWeight: "800",
    },

    subtitle: {
      marginTop: 4,
      color: "#666666",
    },

    backButton: {
      backgroundColor: "#dddddd",
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 10,
    },

    backButtonText: {
      fontWeight: "600",
    },

    card: {
      backgroundColor: "#ffffff",
      padding: 20,
      borderRadius: 16,
    },

    label: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 7,
    },

    input: {
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      marginBottom: 20,
    },

    roleContainer: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 26,
    },

    roleButton: {
      flex: 1,
      paddingVertical: 13,
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#cccccc",
    },

    roleSelected: {
      backgroundColor: "#111111",
      borderColor: "#111111",
    },

    roleText: {
      fontWeight: "600",
    },

    roleSelectedText: {
      color: "#ffffff",
    },

    saveButton: {
      backgroundColor: "#111111",
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
    },

    saveText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
    },

    disabledButton: {
      opacity: 0.5,
    },
  });