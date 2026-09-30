import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";

import { supabase } from "../lib/supabase";

type AttendanceType = "entrada" | "salida";

type LastAttendance = {
  type: AttendanceType;
  created_at: string;
};

export default function HomeScreen() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const [loadingAttendance, setLoadingAttendance] =
    useState(false);

  const [lastAttendance, setLastAttendance] =
    useState<LastAttendance | null>(null);

  useEffect(() => {
    loadUser();
    loadLastAttendance();
  }, []);

  async function loadUser() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      setEmail(user.email ?? "");

      const { data: profile, error } =
        await supabase
          .from("profiles")
          .select("name, role")
          .eq("id", user.id)
          .single();

      if (error) {
        console.log(
          "Error obteniendo perfil:",
          error.message
        );
        return;
      }

      if (profile) {
        setName(profile.name);
        setRole(profile.role);
      }
    } catch (error) {
      console.error(
        "Error cargando usuario:",
        error
      );
    }
  }

  async function loadLastAttendance() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data, error } =
        await supabase
          .from("attendance")
          .select("type, created_at")
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (error) {
        console.log(
          "Error consultando asistencia:",
          error.message
        );
        return;
      }

      if (data) {
        setLastAttendance({
          type: data.type as AttendanceType,
          created_at: data.created_at,
        });
      } else {
        setLastAttendance(null);
      }
    } catch (error) {
      console.error(
        "Error obteniendo asistencia:",
        error
      );
    }
  }

  async function authenticateBiometric() {
    const hasHardware =
      await LocalAuthentication.hasHardwareAsync();

    if (!hasHardware) {
      Alert.alert(
        "Biometría no disponible",
        "Este dispositivo no cuenta con biometría compatible."
      );

      return false;
    }

    const isEnrolled =
      await LocalAuthentication.isEnrolledAsync();

    if (!isEnrolled) {
      Alert.alert(
        "Biometría no configurada",
        "Configura una huella o reconocimiento facial en tu dispositivo."
      );

      return false;
    }

    const result =
      await LocalAuthentication.authenticateAsync({
        promptMessage:
          "Confirma tu identidad para registrar asistencia",
        cancelLabel: "Cancelar",
        fallbackLabel: "Usar código",
        disableDeviceFallback: false,
      });

    if (!result.success) {
      Alert.alert(
        "Autenticación cancelada",
        "No se pudo validar tu identidad."
      );

      return false;
    }

    return true;
  }

  function canRegister(type: AttendanceType) {
    if (!lastAttendance) {
      return type === "entrada";
    }

    if (lastAttendance.type === "entrada") {
      return type === "salida";
    }

    return type === "entrada";
  }

  async function registerAttendance(
    type: AttendanceType
  ) {
    if (loadingAttendance) {
      return;
    }

    if (!canRegister(type)) {
      Alert.alert(
        "Registro no permitido",
        type === "entrada"
          ? "Primero debes registrar una salida."
          : "Primero debes registrar una entrada."
      );

      return;
    }

    try {
      setLoadingAttendance(true);

      const authenticated =
        await authenticateBiometric();

      if (!authenticated) {
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          "Sesión inválida",
          "No se encontró una sesión activa."
        );

        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .rpc("register_attendance", {
            p_type: type,
            p_device_id: "mobile",
        });

      if (error) {
        console.error(
            "Error registrando asistencia:",
            error
        );

        Alert.alert(
            "Registro no permitido",
            error.message
        );

        return;
        }

      setLastAttendance({
        type: data.type as AttendanceType,
        created_at: data.created_at,
      });

      Alert.alert(
        "Asistencia registrada",
        type === "entrada"
          ? "Tu entrada fue registrada correctamente."
          : "Tu salida fue registrada correctamente."
      );
    } catch (error) {
      console.error(
        "Error registrando asistencia:",
        error
      );

      Alert.alert(
        "Error",
        "Ocurrió un problema al registrar la asistencia."
      );
    } finally {
      setLoadingAttendance(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    router.replace("/");
  }

  const entryEnabled =
    canRegister("entrada") &&
    !loadingAttendance;

  const exitEnabled =
    canRegister("salida") &&
    !loadingAttendance;

  const lastTime = lastAttendance
    ? new Date(
        lastAttendance.created_at
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>
        Bienvenido
      </Text>

      <Text style={styles.name}>
        {name || "Usuario"}
      </Text>

      <Text style={styles.email}>
        {email}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Registro de asistencia
        </Text>

        <Text style={styles.statusLabel}>
          Último registro:
        </Text>

        <Text style={styles.statusValue}>
          {lastAttendance
            ? lastAttendance.type.toUpperCase()
            : "SIN REGISTROS"}
        </Text>

        {lastTime && (
          <Text style={styles.lastTime}>
            Hora: {lastTime}
          </Text>
        )}

        <Text style={styles.nextAction}>
          {lastAttendance?.type === "entrada"
            ? "Siguiente acción: registrar salida"
            : "Siguiente acción: registrar entrada"}
        </Text>

        <Pressable
          style={[
            styles.attendanceButton,
            styles.entryButton,
            !entryEnabled &&
              styles.disabledButton,
          ]}
          disabled={!entryEnabled}
          onPress={() =>
            registerAttendance("entrada")
          }
        >
          <Text
            style={styles.attendanceButtonText}
          >
            {loadingAttendance
              ? "Validando..."
              : "Registrar entrada"}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.attendanceButton,
            styles.exitButton,
            !exitEnabled &&
              styles.disabledButton,
          ]}
          disabled={!exitEnabled}
          onPress={() =>
            registerAttendance("salida")
          }
        >
          <Text
            style={styles.attendanceButtonText}
          >
            {loadingAttendance
              ? "Validando..."
              : "Registrar salida"}
          </Text>
        </Pressable>
      </View>

      {role === "admin" && (
        <Pressable
          style={styles.adminButton}
          onPress={() =>
            router.push("/admin")
          }
        >
          <Text style={styles.adminButtonText}>
            Panel administrativo
          </Text>
        </Pressable>
      )}

      <Pressable
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>
          Cerrar sesión
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f5f5",
  },

  welcome: {
    fontSize: 18,
    color: "#555555",
  },

  name: {
    fontSize: 30,
    fontWeight: "700",
    marginTop: 4,
  },

  email: {
    fontSize: 15,
    color: "#666666",
    marginTop: 4,
    marginBottom: 28,
  },

  card: {
    backgroundColor: "#ffffff",
    padding: 22,
    borderRadius: 16,
  },

  cardTitle: {
    fontSize: 21,
    fontWeight: "700",
    marginBottom: 22,
  },

  statusLabel: {
    fontSize: 14,
    color: "#666666",
  },

  statusValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },

  lastTime: {
    marginTop: 6,
    fontSize: 15,
    color: "#555555",
  },

  nextAction: {
    marginTop: 10,
    marginBottom: 22,
    fontSize: 15,
    fontWeight: "500",
  },

  attendanceButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },

  entryButton: {
    backgroundColor: "#111111",
  },

  exitButton: {
    backgroundColor: "#444444",
  },

  attendanceButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },

  disabledButton: {
    opacity: 0.3,
  },

  adminButton: {
    marginTop: 24,
    backgroundColor: "#222222",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  adminButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  logoutButton: {
    marginTop: 12,
    padding: 15,
    alignItems: "center",
  },

  logoutText: {
    fontSize: 16,
    fontWeight: "500",
  },
});