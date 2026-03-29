"use client";

import React, { useEffect, useState } from "react";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { usePathname } from "next/navigation";
import { link as linkStyles } from "@heroui/theme";
import NextLink from "next/link";
import clsx from "clsx";
import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { ChartNoAxesColumn, LogOut } from "lucide-react";
import { Divider } from "@heroui/divider";
import { Button } from "@heroui/button";
import { logout } from "@/app/actions/auth-actions";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // SI LA RUTA ES /LOGIN, NO RENDERIZAMOS NADA
  if (pathname === "/login") return null;

  return (
    <HeroUINavbar 
      classNames={{
        base: "z-[100]",
        wrapper: "z-[100]",
        menu: "z-[101]",
        menuItem: "z-[101]",
      }} 
      isMenuOpen={isMenuOpen}
      maxWidth="xl"
      position="sticky"
      onMenuOpenChange={setIsMenuOpen}
    >
      {/* Contenido Superior (Brand y Desktop Nav) */}
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <ChartNoAxesColumn />
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-4 justify-start ml-5">
          {siteConfig.navItems.map((item, index, array) => {
            const isActive = pathname === item.href;

            return (
              <React.Fragment key={item.href}>
                <NavbarItem isActive={isActive}>
                  <NextLink
                    data-text={item.label}
                    className={clsx(
                      linkStyles({ color: "foreground" }), 
                      isActive ? "!text-blue-500 font-bold" : "",
                      "flex flex-col items-center after:content-[attr(data-text)] after:font-bold after:h-0 after:invisible after:overflow-hidden"
                    )}
                    href={item.href}
                  >
                    {item.label}
                  </NextLink>
                </NavbarItem>
                
                {index < array.length - 1 && (
                  <Divider orientation="vertical" className="h-5 self-center opacity-50 mx-2" />
                )}
              </React.Fragment>
            );
          })}
        </ul>
      </NavbarContent>

      {/* Acciones Derecha (Desktop) */}
      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2 items-center">
          <ThemeSwitch />
          <form action={logout}>
            <Button 
              isIconOnly 
              color="danger"
              size="sm" 
              variant="light" 
              type="submit"
              aria-label="Cerrar sesión"
            >
              <LogOut size={20} />
            </Button>
          </form>
        </NavbarItem>
        <NavbarItem className="hidden md:flex">
        </NavbarItem>
      </NavbarContent>

      {/* Controles para Móvil */}
      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      {/* Menú Desplegable Móvil */}
      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item.label}-${index}`}>
              <NextLink
                onClick={() => setIsMenuOpen(false)}
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "text-lg w-full",
                  pathname === item.href ? "text-blue-500 font-bold" : ""
                )}
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarMenuItem>
          ))}
          
          {/* Botón de Cerrar Sesión en Móvil */}
          <Divider className="my-2" />
          <NavbarMenuItem>
            <form action={logout} className="w-full">
              <Button 
                fullWidth
                className="justify-start px-0 text-danger" 
                startContent={<LogOut size={20} />} 
                variant="light" 
                type="submit"
              >
                Cerrar Sesión
              </Button>
            </form>
          </NavbarMenuItem>
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
