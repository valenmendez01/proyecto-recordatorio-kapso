"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Trash2, Plus, Pencil, Search } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useDisclosure } from "@heroui/modal";
import { Tooltip } from "@heroui/tooltip";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Button } from "@heroui/button";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";
import { User } from "@heroui/user";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import useSWR from 'swr';

import { Paciente, PacienteInsert, PacienteUpdate } from "@/types/types";
import { usePacientesStore } from "./store/pacientesStore";

const supabase = createClient();

// Fuera del componente
const fetcher = async ([url, filter, page, rowsPerPage]: [string, string, number, number]) => {
  const from = (page - 1) * rowsPerPage;
  const to = from + rowsPerPage - 1;

  let query = supabase
    .from("pacientes")
    .select("*", { count: "exact" })
    .order("apellido", { ascending: true })
    .range(from, to);

  if (filter) {
    query = query.or(`nombre.ilike.%${filter}%,apellido.ilike.%${filter}%,dni.ilike.%${filter}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
};

export default function TablaClientes() {
  // UI States
  const { filterValue, page, rowsPerPage, setFilterValue, setPage, setRowsPerPage } = usePacientesStore();
  
  // Datos 
  const { data, error, isLoading, mutate } = useSWR(
    ['pacientes', filterValue, page, rowsPerPage], 
    fetcher,
    { keepPreviousData: true } // Mantiene la tabla visible mientras carga la siguiente página
  );
  const [nuevoPaciente, setNuevoPaciente] = useState<PacienteInsert>({
    dni: "",
    nombre: "",
    apellido: "",
    telefono: "",
  });
  const [editingPaciente, setEditingPaciente] = useState<PacienteUpdate | null>(null);

  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [modalNuevo, setModalNuevo] = useState(false);
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [pacienteAEliminar, setPacienteAEliminar] = useState<Paciente | null>(null);

  const PHONE_REGEX = /^549\d{10}$/;

  const [isMobile, setIsMobile] = useState(false);

  const pacientes = data?.data ?? [];
  const totalCount = data?.count ?? 0;

  const columns = [
    { name: "PACIENTE", uid: "paciente" },
    { name: <span><span className="md:hidden">TEL</span><span className="hidden md:inline">TELÉFONO</span></span>, uid: "telefono" },
    { name: <span><span className="md:hidden">ACC</span><span className="hidden md:inline">ACCIONES</span></span>, uid: "acciones" },
  ];

  // Cálculo de páginas totales basado en la respuesta del servidor
  const pages = Math.ceil(totalCount / rowsPerPage) || 1;

  const agregarPaciente = async () => {
    if (!nuevoPaciente.dni || !nuevoPaciente.nombre || !nuevoPaciente.apellido || !nuevoPaciente.telefono) {
      addToast({ title: "Campos incompletos", description: "Todos los campos son obligatorios", color: "danger" });

      return;
    }
    if (!PHONE_REGEX.test(nuevoPaciente.telefono)) {
      addToast({ title: "Teléfono inválido", description: "El formato debe ser 549...", color: "danger" });
      
      return;
    }

    const { error } = await supabase.from("pacientes").insert([nuevoPaciente]);

    if (!error) {
      addToast({ title: "Paciente registrado", description: "El paciente se guardó correctamente.", color: "success" });
      mutate(); 
      setModalNuevo(false);
      setNuevoPaciente({ dni: "", nombre: "", apellido: "", telefono: "" });
    } else {
      addToast({ title: "Error", description: "No se pudo registrar al paciente.", color: "danger" }); //
    }
  };

  const eliminarPaciente = async () => {
    if (!pacienteAEliminar) return;
    const { error } = await supabase.from("pacientes").delete().eq("id", pacienteAEliminar.id);

    if (error) {
      addToast({ title: "Error", description: error.message, color: "danger" }); //
    } else {
      addToast({ title: "Paciente eliminado", description: "El registro ha sido borrado.", color: "success" });
      mutate();
      onDeleteClose();
    }
  };

  const guardarEdicion = async () => {
    if (!editingPaciente || !editingPaciente.id) return;
    if (!PHONE_REGEX.test(editingPaciente.telefono || "")) {
      addToast({ title: "Error en edición", description: "El formato del teléfono es inválido", color: "danger" });
      return;
    }

    const { error } = await supabase
      .from("pacientes")
      .update({
        nombre: editingPaciente.nombre,
        apellido: editingPaciente.apellido,
        dni: editingPaciente.dni,
        telefono: editingPaciente.telefono,
      })
      .eq("id", editingPaciente.id);

    if (!error) {
      addToast({ title: "Cambios guardados", description: "La información se actualizó con éxito.", color: "success" });
      mutate();
      onEditClose();
    } else {
      addToast({ title: "Error", description: "Hubo un problema al actualizar los datos.", color: "danger" });
    }
  };

  const renderCell = useCallback((paciente: Paciente, columnKey: React.Key) => {
    switch (columnKey) {
      case "paciente":
        return (
          <User
            avatarProps={{ showFallback: true, color: "primary", className: "hidden md:flex w-10 h-10" }}
            classNames={{
              name: "text-sm md:text-base",
              description: "text-xs md:text-sm"
            }}
            description={`DNI: ${paciente.dni}`}
            name={`${paciente.nombre} ${paciente.apellido}`}
          />
        );
      case "telefono":
        return (
          <p className="text-xs md:text-sm break-all">
            {paciente.telefono}
          </p>
        );
      case "acciones":
        return (
          <div className="flex items-center md:gap-2 justify-center">
            <Tooltip content="Editar">
              <Button isIconOnly variant="light" className="w-7 h-7 min-w-0 p-0 md:w-9 md:h-9" onPress={() => { setEditingPaciente({ ...paciente }); onEditOpen(); }}>
                <Pencil className="w-4 h-4 md:w-5 md:h-5 text-default-400" />
              </Button>
            </Tooltip>
            <Tooltip color="danger" content="Eliminar">
              <Button isIconOnly variant="light" color="danger" className="w-7 h-7 min-w-0 p-0 md:w-9 md:h-9" onPress={() => { setPacienteAEliminar(paciente); onDeleteOpen(); }}>
                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </Tooltip>
          </div>
        );
      default:
        return String(paciente[columnKey as keyof Paciente]);
    }
  }, []);

  const topContent = useMemo(() => (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
      <Input
        isClearable
        className="w-full sm:max-w-[44%]"
        classNames={{
          input: "text-base"  // fuerza 16px, evita el zoom
        }}
        placeholder="Buscar por nombre o DNI..."
        startContent={<Search size={18} />}
        value={filterValue}
        onValueChange={setFilterValue}
        onClear={() => setFilterValue("")}
      />
      <div className="flex gap-3 items-center w-full sm:w-auto justify-between sm:justify-end">
        <Select
          className="w-24"
          labelPlacement="outside"
          selectedKeys={[String(rowsPerPage)]}
          onChange={(e) => setRowsPerPage(Number(e.target.value))}
          size="sm"
          aria-label="Filas por página"
        >
          <SelectItem key="5">5</SelectItem>
          <SelectItem key="10">10</SelectItem>
          <SelectItem key="15">15</SelectItem>
        </Select>
          <Button color="primary" startContent={<Plus size={16} />} onPress={() => setModalNuevo(true)} className="text-xs px-2 md:text-sm md:px-4">
            <span className="tracking-wider">Nuevo</span>
          </Button>
      </div>
    </div>
  ), [filterValue, rowsPerPage, setFilterValue, setRowsPerPage]);

  const bottomContent = useMemo(() => (
    <div className="py-2 px-2 flex justify-center">
      <Pagination
        isCompact
        showControls
        color="primary"
        page={page}
        total={pages}
        onChange={setPage}
      />
    </div>
  ), [page, pages, setPage]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <Card className="p-4 md:p-6">
      <Table
        aria-label="Tabla de gestión de pacientes"
        bottomContent={bottomContent}
        topContent={topContent}
        topContentPlacement="outside"
      >
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn key={column.uid} align={column.uid === "acciones" ? "center" : "start"}>
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody 
          emptyContent={isLoading ? <Spinner /> : "No se encontraron pacientes"}
          items={pacientes} // Usamos el estado directamente, ya viene filtrado y paginado
        >
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* MODALES (Se mantienen igual para edición/creación) */}
      <Modal isOpen={modalNuevo} placement="center" scrollBehavior="inside" size={isMobile ? "xs" : "lg"} onOpenChange={setModalNuevo}>
        <ModalContent className="md:p-2">
          <ModalHeader className="md:text-xl">Registrar Nuevo Paciente</ModalHeader>
          <ModalBody className="gap-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <Input label="Nombre" value={nuevoPaciente.nombre} onChange={e => setNuevoPaciente({...nuevoPaciente, nombre: e.target.value})} />
              <Input label="Apellido" value={nuevoPaciente.apellido} onChange={e => setNuevoPaciente({...nuevoPaciente, apellido: e.target.value})} />
            </div>
            <Input label="DNI" inputMode="numeric" value={nuevoPaciente.dni} onChange={e => setNuevoPaciente({...nuevoPaciente, dni: e.target.value})} />
            <Input 
              label="Teléfono"
              placeholder="5492991234567"
              inputMode="numeric"
              value={nuevoPaciente.telefono}
              description="Formato: 54 + 9 + característica sin 0 + número"
              isInvalid={nuevoPaciente.telefono !== "" && !PHONE_REGEX.test(nuevoPaciente.telefono)}
              errorMessage="Ingrese 13 dígitos comenzando con 549"
              onChange={e => setNuevoPaciente({...nuevoPaciente, telefono: e.target.value})} 
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalNuevo(false)}>Cancelar</Button>
            <Button color="primary" onPress={agregarPaciente}>Guardar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isEditOpen} placement="center" scrollBehavior="inside" size={isMobile ? "xs" : "lg"} onOpenChange={onEditClose}>
        <ModalContent className="md:p-2">
          <ModalHeader className="md:text-xl">Editar Paciente</ModalHeader>
          <ModalBody className="gap-4">
            {editingPaciente && (
              <>
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <Input label="Nombre" value={editingPaciente.nombre || ""} onChange={e => setEditingPaciente({...editingPaciente, nombre: e.target.value})} />
                  <Input label="Apellido" value={editingPaciente.apellido || ""} onChange={e => setEditingPaciente({...editingPaciente, apellido: e.target.value})} />
                </div>
                <Input label="DNI" inputMode="numeric" value={editingPaciente.dni || ""} onChange={e => setEditingPaciente({...editingPaciente, dni: e.target.value})} />
                <Input 
                  label="Teléfono"
                  inputMode="numeric"
                  value={editingPaciente.telefono || ""} 
                  placeholder="5492991234567"
                  isInvalid={editingPaciente.telefono !== "" && !PHONE_REGEX.test(editingPaciente.telefono || "")}
                  errorMessage="Formato inválido (ej: 5492991234567)"
                  onChange={e => setEditingPaciente({...editingPaciente, telefono: e.target.value})} 
                />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onEditClose}>Cancelar</Button>
            <Button color="primary" onPress={guardarEdicion}>Actualizar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDeleteOpen} placement="center" size={isMobile ? "xs" : "lg"} onOpenChange={onDeleteClose}>
        <ModalContent className="md:p-2">
          <ModalHeader className="md:text-xl">Confirmar eliminación</ModalHeader>
          <ModalBody>
            <p>¿Estás seguro de eliminar a <strong>{pacienteAEliminar?.nombre} {pacienteAEliminar?.apellido}</strong>?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onDeleteClose}>Cancelar</Button>
            <Button color="danger" onPress={eliminarPaciente}>Eliminar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}