export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Turnos",
  description: "Gestión de mis turnos",
  navItems: [
    {
      label: "Calendario",
      href: "/",
    },
    {
      label: "Pacientes",
      href: "/pacientes",
    },
    {
      label: "Configuración",
      href: "/configuracion",
    },
  ],
  navMenuItems: [
    {
      label: "Calendario",
      href: "/",
    },
    {
      label: "Pacientes",
      href: "/pacientes",
    },
    {
      label: "Configuración",
      href: "/configuracion",
    },
  ],
};
