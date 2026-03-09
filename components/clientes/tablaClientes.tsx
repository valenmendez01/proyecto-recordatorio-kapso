"use client";

import type { Perfil, PerfilInsert, PerfilUpdate } from "@/types/types";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trash2, Plus, Save, Upload, Loader2, Eye, Pencil, Search } from "lucide-react";
import { parseTime, today } from "@internationalized/date";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { useDisclosure } from "@heroui/modal";
import { Tooltip } from "@heroui/tooltip";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell} from "@heroui/table";
import { Button } from "@heroui/button";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter} from "@heroui/modal";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";
import { Image } from "@heroui/image";

// Inicializar Supabase
const supabase = createClient();

export default function tablaClientes() {
  const router = useRouter();

  // UI States
  const [loadingInicial, setLoadingInicial] = useState(true);

  // Estados para Clientes
  const [clientes, setClientes] = useState<Perfil[]>([]);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState<PerfilInsert>({
    id: "",
    nombre: "",
    apellido: "",
    dni: "",
    email_principal: "",
    email_secundario: null,
    telefono: "",
    role: "cliente",
  });

  const [selectedCliente, setSelectedCliente] = useState<Perfil | null>(null);
  const [editingCliente, setEditingCliente] = useState<Perfil | null>(null);

  const {
    isOpen: isDetailsOpen,
    onOpen: onDetailsOpen,
    onClose: onDetailsClose,
  } = useDisclosure();
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure();

  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const rowsPerPageOptions = [
    { key: "5", label: "5" },
    { key: "10", label: "10" },
    { key: "15", label: "15" },
    { key: "20", label: "20" },
  ];

  const columns = [
    { name: "CLIENTE", uid: "cliente" },
    { name: "EMAIL PRINCIPAL", uid: "email_principal" },
    { name: "TELÉFONO", uid: "telefono" },
    { name: "ACCIONES", uid: "acciones" },
  ];

  // ==================== CARGAR DATOS INICIALES ====================

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    setLoadingInicial(true);
    try {
      await Promise.all([
        cargarClientes(),
      ]);
    } catch (error) {
      alert("Error cargando datos: " + error);
      alert("Error al cargar los datos");
    } finally {
      setLoadingInicial(false);
    }
  };

  const cargarClientes = useCallback(async () => {
    const { data, error } = await supabase
      .from("perfiles")
      .select("*")
      .neq("role", "admin")
      .order("apellido", { ascending: true });

    if (error) {
      alert("Error cargando clientes: " + error.message);

      return;
    }
    setClientes(data || []);
  }, []);

  // ==================== FUNCIONES DE CLIENTES ====================

  const agregarCliente = async () => {
    if (
      !nuevoCliente.nombre.trim() ||
      !nuevoCliente.apellido.trim() ||
      !nuevoCliente.dni.trim() ||
      !nuevoCliente.email_principal.trim() ||
      !nuevoCliente.telefono.trim()
    ) {
      alert("Todos los campos excepto email secundario son obligatorios");

      return;
    }

    // Generar un ID único para el nuevo cliente (puedes ajustar esto según tu lógica)
    const clienteParaInsertar = {
      ...nuevoCliente,
      id: crypto.randomUUID(),
    };

    const { data, error } = await supabase
      .from("perfiles")
      .insert(clienteParaInsertar)
      .select()
      .single();

    if (error) {
      alert("Error agregando cliente: " + error.message);

      return;
    }

    setClientes([...clientes, data]);
    setModalNuevoCliente(false);
    setNuevoCliente({
      id: "",
      nombre: "",
      apellido: "",
      dni: "",
      email_principal: "",
      email_secundario: null,
      telefono: "",
      role: "cliente",
    });
  };

  const eliminarCliente = async (id: Perfil["id"]) => {
    if (
      !confirm(
        "¿Estás seguro de eliminar este cliente? Esto también eliminará todas sus reservas.",
      )
    )
      return;

    const { error } = await supabase.from("perfiles").delete().eq("id", id);

    if (error) {
      alert("Error al eliminar el cliente: " + error.message);

      return;
    }

    setClientes(clientes.filter((c) => c.id !== id));
  };

  const handleVerDetalles = (cliente: Perfil) => {
    setSelectedCliente(cliente);
    onDetailsOpen();
  };

  const handleEditar = (cliente: Perfil) => {
    setEditingCliente({ ...cliente });
    onEditOpen();
  };

  const handleGuardarEdicion = async () => {
    if (!editingCliente) return;

    const updates: PerfilUpdate = {
      nombre: editingCliente.nombre,
      apellido: editingCliente.apellido,
      dni: editingCliente.dni,
      email_principal: editingCliente.email_principal,
      email_secundario: editingCliente.email_secundario,
      telefono: editingCliente.telefono,
    };

    const { error } = await supabase
      .from("perfiles")
      .update(updates)
      .eq("id", editingCliente.id);

    if (error) {
      alert("Error al actualizar el cliente: " + error.message);

      return;
    }

    setClientes(
      clientes.map((c) => (c.id === editingCliente.id ? editingCliente : c)),
    );
    onEditClose();
  };

  const hasSearchFilter = Boolean(filterValue);

  const filteredItems = useMemo(() => {
    let filteredClientes = [...clientes];

    if (hasSearchFilter) {
      filteredClientes = filteredClientes.filter((cliente) =>
        `${cliente.nombre} ${cliente.apellido}`
          .toLowerCase()
          .includes(filterValue.toLowerCase()),
      );
    }

    return filteredClientes;
  }, [clientes, filterValue]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return filteredItems.slice(start, end);
  }, [page, filteredItems, rowsPerPage]);

  const onSearchChange = useCallback((value?: string) => {
    if (value) {
      setFilterValue(value);
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const onClear = useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const onRowsPerPageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setRowsPerPage(Number(e.target.value));
      setPage(1);
    },
    [],
  );

  const renderCell = useCallback(
    (cliente: Perfil, columnKey: React.Key) => {
      const cellValue = cliente[columnKey as keyof Perfil];

      switch (columnKey) {
        case "cliente":
          return (
            <User
              avatarProps={{
                showFallback: true,
                color: "primary",
              }}
              description={`DNI: ${cliente.dni}`}
              name={`${cliente.nombre} ${cliente.apellido}`}
            />
          );
        case "email_principal":
          return (
            <div className="flex flex-col">
              <p className="text-sm">{cellValue}</p>
            </div>
          );
        case "telefono":
          return (
            <div className="flex flex-col">
              <p className="text-sm">{cellValue}</p>
            </div>
          );
        case "acciones":
          return (
            <div className="relative flex items-center justify-center gap-2">
              <Tooltip content="Ver detalles">
                <Button
                  isIconOnly
                  color="primary"
                  variant="light"
                  onPress={() => handleVerDetalles(cliente)}
                >
                  <Eye size={20} />
                </Button>
              </Tooltip>
              <Tooltip content="Editar cliente">
                <Button
                  isIconOnly
                  color="primary"
                  variant="light"
                  onPress={() => handleEditar(cliente)}
                >
                  <Pencil size={20} />
                </Button>
              </Tooltip>
              <Tooltip color="danger" content="Eliminar cliente">
                <Button
                  isIconOnly
                  color="danger"
                  variant="light"
                  onPress={() => eliminarCliente(cliente.id)}
                >
                  <Trash2 size={20} />
                </Button>
              </Tooltip>
            </div>
          );
        default:
          return cellValue;
      }
    },
    [clientes],
  );

  const topContent = useMemo(() => {
    return (
      <div className="flex justify-between items-center">
        <Input
          isClearable
          className="w-full sm:max-w-[44%]"
          placeholder="Buscar por nombre..."
          startContent={<Search />}
          value={filterValue}
          onClear={() => onClear()}
          onValueChange={onSearchChange}
        />
        <label className="flex items-center text-default-400 text-small gap-3">
          <div>Filas por página:</div>
          <Select
            aria-label="Filas por página"
            className="w-20"
            classNames={{
              trigger: "min-h-unit-8 h-8",
              value: "text-small text-default-400",
            }}
            selectedKeys={[String(rowsPerPage)]}
            size="sm"
            onChange={onRowsPerPageChange}
          >
            {rowsPerPageOptions.map((option) => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>
        </label>
      </div>
    );
  }, [filterValue, onSearchChange, filteredItems.length, rowsPerPage]);

  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-center items-center">
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={page}
          total={pages || 1}
          onChange={setPage}
        />
      </div>
    );
  }, [page, pages]);

  return (
    <div className="flex justify-center">
      <Card className="container mx-auto px-8 py-8 max-w-7xl overflow-hidden mb-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Clientes</h1>

          {/* Botón para abrir el modal */}
          <Button
            className="gap-2"
            color="primary"
            onPress={() => setModalNuevoCliente(true)}
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </Button>
        </div>

        <Table
          aria-label="Tabla de clientes con acciones"
          bottomContent={bottomContent}
          bottomContentPlacement="outside"
          topContent={topContent}
          topContentPlacement="outside"
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn
                key={column.uid}
                align={column.uid === "acciones" ? "center" : "start"}
              >
                {column.name}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            emptyContent="No hay clientes registrados"
            items={items}
          >
            {(item) => (
              <TableRow key={item.id}>
                {(columnKey) => (
                  <TableCell>{renderCell(item, columnKey)}</TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Modal Nuevo Cliente */}
        <Modal
          backdrop="blur" 
          isDismissable={false}
          isKeyboardDismissDisabled={true}
          isOpen={modalNuevoCliente}
          radius="lg"
          onOpenChange={setModalNuevoCliente}
        >
          <ModalContent>
            <ModalHeader className="text-2xl font-bold bg-clip-text">
              Crear Nuevo Cliente
            </ModalHeader>

            <ModalBody className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Input
                    id="nombre"
                    label="Nombre"
                    labelPlacement="outside"
                    placeholder="Juan"
                    value={nuevoCliente.nombre}
                    onChange={(e) =>
                      setNuevoCliente({
                        ...nuevoCliente,
                        nombre: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="apellido"
                    label="Apellido"
                    labelPlacement="outside"
                    placeholder="Pérez"
                    value={nuevoCliente.apellido}
                    onChange={(e) =>
                      setNuevoCliente({
                        ...nuevoCliente,
                        apellido: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  id="dni"
                  label="DNI"
                  labelPlacement="outside"
                  placeholder="12345678"
                  value={nuevoCliente.dni}
                  onChange={(e) =>
                    setNuevoCliente({
                      ...nuevoCliente,
                      dni: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Input
                  id="email_principal"
                  label="Email Principal"
                  labelPlacement="outside"
                  placeholder="juan@example.com"
                  value={nuevoCliente.email_principal}
                  onChange={(e) =>
                    setNuevoCliente({
                      ...nuevoCliente,
                      email_principal: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Input
                  id="email_secundario"
                  label="Email Secundario"
                  labelPlacement="outside"
                  placeholder="juan.secundario@example.com"
                  value={nuevoCliente.email_secundario || ""}
                  onChange={(e) =>
                    setNuevoCliente({
                      ...nuevoCliente,
                      email_secundario: e.target.value || null,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Input
                  id="telefono"
                  label="Teléfono"
                  labelPlacement="outside"
                  placeholder="+54 9 11 1234-5678"
                  value={nuevoCliente.telefono}
                  onChange={(e) =>
                    setNuevoCliente({
                      ...nuevoCliente,
                      telefono: e.target.value,
                    })
                  }
                />
              </div>
            </ModalBody>

            <ModalFooter className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onPress={() => setModalNuevoCliente(false)}
              >
                Cancelar
              </Button>
              <Button color="primary" onPress={agregarCliente}>
                <Save className="w-4 h-4 mr-2" />
                Guardar Cliente
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Modal de Detalles */}
        <Modal isOpen={isDetailsOpen} size="2xl" onClose={onDetailsClose}>
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
              Detalles del Cliente
            </ModalHeader>
            <ModalBody>
              {selectedCliente && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Image
                      alt="Avatar"
                      className="w-16 h-16 rounded-full"
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedCliente.nombre} ${selectedCliente.apellido}`}
                    />
                    <div>
                      <h3 className="text-xl font-bold">
                        {selectedCliente.nombre}{" "}
                        {selectedCliente.apellido}
                      </h3>
                      <p className="text-sm text-default-500">
                        DNI: {selectedCliente.dni}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-semibold text-default-600">
                        Email Principal
                      </p>
                      <p className="text-sm">
                        {selectedCliente.email_principal}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-default-600">
                        Email Secundario
                      </p>
                      <p className="text-sm">
                        {selectedCliente.email_secundario ||
                          "No registrado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-default-600">
                        Teléfono
                      </p>
                      <p className="text-sm">
                        {selectedCliente.telefono}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={onDetailsClose}>
                Cerrar
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Modal de Edición */}
        <Modal isOpen={isEditOpen} size="2xl" onClose={onEditClose}>
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
              Editar Cliente
            </ModalHeader>
            <ModalBody>
              {editingCliente && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Nombre"
                      value={editingCliente.nombre}
                      onChange={(e) =>
                        setEditingCliente({
                          ...editingCliente,
                          nombre: e.target.value,
                        })
                      }
                    />
                    <Input
                      label="Apellido"
                      value={editingCliente.apellido}
                      onChange={(e) =>
                        setEditingCliente({
                          ...editingCliente,
                          apellido: e.target.value,
                        })
                      }
                    />
                  </div>
                  <Input
                    label="DNI"
                    value={editingCliente.dni}
                    onChange={(e) =>
                      setEditingCliente({
                        ...editingCliente,
                        dni: e.target.value,
                      })
                    }
                  />
                  <Input
                    label="Email Principal"
                    type="email"
                    value={editingCliente.email_principal}
                    onChange={(e) =>
                      setEditingCliente({
                        ...editingCliente,
                        email_principal: e.target.value,
                      })
                    }
                  />
                  <Input
                    label="Email Secundario"
                    type="email"
                    value={editingCliente.email_secundario || ""}
                    onChange={(e) =>
                      setEditingCliente({
                        ...editingCliente,
                        email_secundario: e.target.value || null,
                      })
                    }
                  />
                  <Input
                    label="Teléfono"
                    value={editingCliente.telefono}
                    onChange={(e) =>
                      setEditingCliente({
                        ...editingCliente,
                        telefono: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                color="danger"
                variant="light"
                onPress={onEditClose}
              >
                Cancelar
              </Button>
              <Button color="primary" onPress={handleGuardarEdicion}>
                Guardar
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Card>
    </div>
  );
}