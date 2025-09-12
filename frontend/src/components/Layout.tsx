import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import ProfileSetupDialog from "./ProfileSetupDialog";

export function Layout() {
  return (
    <>
      <Header />
      <ProfileSetupDialog />
      <main className="p-4">
        <Outlet />
      </main>
    </>
  );
}
