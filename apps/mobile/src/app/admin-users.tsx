import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  router,
  type Href,
} from "expo-router";

import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  name: string;
  employee_number: string | null;
  role: string;
  created_at: string;
};

export default function AdminUsersScreen() {
  const [users, setUsers] =
    useState<Profile[]>([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    verifyAdmin();
  }, []);

  async function verifyAdmin() {
    try {
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
        router.replace("/home");
        return;
      }

      await loadUsers();
    } catch (error) {
      console.error(
        "Error verificando admin:",
        error
      );

      router.replace("/home");
    }
  }

  async function loadUsers() {
    try {
      setErrorMessage("");

      const { data, error } =
        await supabase
          .from("profiles")
          .select(
            "id, name, employee_number, role, created_at"
          )
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        setErrorMessage(
          error.message
        );

        return;
      }

      setUsers(
        (data ?? []) as Profile[]
      );
    } catch (error) {
      console.error(
        "Error cargando usuarios:",
        error
      );

      setErrorMessage(
        "No fue posible cargar los usuarios."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);

    await loadUsers();
  }

  const filteredUsers =
    users.filter((item) => {
      const value =
        search
          .trim()
          .toLowerCase();

      if (!value) {
        return true;
      }

      return (
        item.name
          .toLowerCase()
          .includes(value) ||
        (
          item.employee_number ??
          ""
        )
          .toLowerCase()
          .includes(value) ||
        item.role
          .toLowerCase()
          .includes(value)
      );
    });

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
        />

        <Text
          style={styles.loadingText}
        >
          Cargando usuarios...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Usuarios
          </Text>

          <Text
            style={styles.subtitle}
          >
            {users.length} registrados
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

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nombre, número o rol"
      />

      {errorMessage ? (
        <View
          style={styles.errorCard}
        >
          <Text
            style={styles.errorTitle}
          >
            Error
          </Text>

          <Text
            style={styles.errorText}
          >
            {errorMessage}
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={loadUsers}
          >
            <Text
              style={styles.retryText}
            >
              Reintentar
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) =>
            item.id
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={
                handleRefresh
              }
            />
          }
          contentContainerStyle={
            styles.list
          }
          ListEmptyComponent={
            <Text
              style={styles.empty}
            >
              No se encontraron
              usuarios.
            </Text>
          }
          renderItem={({ item }) => {
            const date =
              new Date(
                item.created_at
              ).toLocaleDateString(
                "es-MX"
              );

            return (
              <Pressable
                style={
                  styles.userCard
                }
                onPress={() =>
                  router.push(
                    {
                      pathname:
                        "/admin-user-edit",

                      params: {
                        id: item.id,
                      },
                    } as Href
                  )
                }
              >
                <View
                  style={
                    styles.userHeader
                  }
                >
                  <View
                    style={
                      styles.userInfo
                    }
                  >
                    <Text
                      style={
                        styles.userName
                      }
                    >
                      {item.name}
                    </Text>

                    <Text
                      style={
                        styles.userNumber
                      }
                    >
                      {item.employee_number
                        ? `Número: ${item.employee_number}`
                        : "Sin número asignado"}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.roleBadge
                    }
                  >
                    <Text
                      style={
                        styles.roleText
                      }
                    >
                      {item.role.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.bottomRow
                  }
                >
                  <Text
                    style={
                      styles.createdText
                    }
                  >
                    Registro: {date}
                  </Text>

                  <Text
                    style={
                      styles.editText
                    }
                  >
                    Editar →
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
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

    loading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },

    loadingText: {
      marginTop: 15,
      fontSize: 16,
    },

    header: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 18,
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
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: "#dddddd",
    },

    backButtonText: {
      fontWeight: "600",
    },

    searchInput: {
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#dddddd",
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      marginBottom: 18,
    },

    list: {
      paddingBottom: 30,
    },

    userCard: {
      backgroundColor: "#ffffff",
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
    },

    userHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "flex-start",
    },

    userInfo: {
      flex: 1,
      paddingRight: 12,
    },

    userName: {
      fontSize: 19,
      fontWeight: "700",
    },

    userNumber: {
      marginTop: 5,
      color: "#666666",
    },

    roleBadge: {
      backgroundColor: "#eeeeee",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },

    roleText: {
      fontSize: 11,
      fontWeight: "800",
    },

    bottomRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      marginTop: 16,
    },

    createdText: {
      fontSize: 13,
      color: "#777777",
    },

    editText: {
      fontSize: 14,
      fontWeight: "700",
    },

    errorCard: {
      backgroundColor: "#ffffff",
      padding: 20,
      borderRadius: 16,
    },

    errorTitle: {
      fontSize: 19,
      fontWeight: "700",
    },

    errorText: {
      marginTop: 8,
    },

    retryButton: {
      marginTop: 18,
      backgroundColor: "#111111",
      padding: 13,
      borderRadius: 10,
      alignItems: "center",
    },

    retryText: {
      color: "#ffffff",
      fontWeight: "700",
    },

    empty: {
      textAlign: "center",
      color: "#666666",
      marginTop: 40,
    },
  });