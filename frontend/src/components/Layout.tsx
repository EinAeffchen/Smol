import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import ProfileSetupDialog from "./ProfileSetupDialog";
import { BinaryNavigationControls } from "./BinaryNavigationControls";

export function Layout() {
  return (
    <>
      <Header />
      <BinaryNavigationControls />
      <ProfileSetupDialog />
      <main className="p-4">
        <Outlet />
      </main>
    </>
  );
}
