import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Fade, IconButton, Tooltip, SxProps, Theme } from "@mui/material";
import { ArrowBackIosNew, ArrowForwardIos } from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";
import { getConfig } from "../services/config";

type StoredLocation = Pick<Location, "pathname" | "search" | "hash" | "state" | "key">;

interface BinaryNavigationControlsProps {
  variant?: "global" | "overlay";
  sx?: SxProps<Theme>;
}

interface HistoryState {
  current: StoredLocation;
  backStack: StoredLocation[];
  forwardStack: StoredLocation[];
  lastKey: string;
  action: "push" | "back" | "forward";
}

function cloneLocation(location: Location): StoredLocation {
  return {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    state: location.state,
    key: location.key,
  };
}

export function BinaryNavigationControls({ variant = "global", sx }: BinaryNavigationControlsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const historyRef = useRef<HistoryState | null>(null);
  const [isBinaryEnvironment, setIsBinaryEnvironment] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const isOverlay = variant === "overlay";

  useEffect(() => {
    let isMounted = true;
    getConfig()
      .then((config) => {
        if (!isMounted) return;
        const isBinary = !!config.general.is_binary;
        const isDocker = !!config.general.is_docker;
        setIsBinaryEnvironment(isBinary && !isDocker);
      })
      .catch(() => {
        if (isMounted) setIsBinaryEnvironment(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isBinaryEnvironment) {
      historyRef.current = null;
      setCanGoBack(false);
      setCanGoForward(false);
      return;
    }

    if (!historyRef.current) {
      historyRef.current = {
        current: cloneLocation(location),
        backStack: [],
        forwardStack: [],
        lastKey: location.key,
        action: "push",
      };
      setCanGoBack(false);
      setCanGoForward(false);
      return;
    }

    const history = historyRef.current;
    if (history.lastKey === location.key) {
      return;
    }

    if (history.action === "back" || history.action === "forward") {
      history.current = cloneLocation(location);
      history.lastKey = location.key;
      history.action = "push";
      setCanGoBack(history.backStack.length > 0);
      setCanGoForward(history.forwardStack.length > 0);
      return;
    }

    history.backStack.push(history.current);
    history.current = cloneLocation(location);
    history.forwardStack = [];
    history.lastKey = location.key;
    setCanGoBack(history.backStack.length > 0);
    setCanGoForward(false);
  }, [location, isBinaryEnvironment]);

  const goBack = useCallback(() => {
    const history = historyRef.current;
    if (!history || history.backStack.length === 0) return;

    const target = history.backStack.pop()!;
    history.forwardStack.push(history.current);
    history.action = "back";
    setCanGoBack(history.backStack.length > 0);
    setCanGoForward(history.forwardStack.length > 0);

    navigate(
      {
        pathname: target.pathname,
        search: target.search,
        hash: target.hash,
      },
      { state: target.state, replace: true }
    );
  }, [navigate]);

  const goForward = useCallback(() => {
    const history = historyRef.current;
    if (!history || history.forwardStack.length === 0) return;

    const target = history.forwardStack.pop()!;
    history.backStack.push(history.current);
    history.action = "forward";
    setCanGoBack(history.backStack.length > 0);
    setCanGoForward(history.forwardStack.length > 0);

    navigate(
      {
        pathname: target.pathname,
        search: target.search,
        hash: target.hash,
      },
      { state: target.state, replace: true }
    );
  }, [navigate]);

  const controlButtons = (
    <>
      <Tooltip title="Back" arrow>
        <span>
          <IconButton onClick={goBack} disabled={!canGoBack} size="small">
            <ArrowBackIosNew fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Forward" arrow>
        <span>
          <IconButton onClick={goForward} disabled={!canGoForward} size="small">
            <ArrowForwardIos fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
    </>
  );

  if (!isBinaryEnvironment) {
    return null;
  }

  if (isOverlay) {
    return (
      <Fade in={isBinaryEnvironment}>
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            gap: 1,
            px: 1,
            py: 0.5,
            borderRadius: "999px",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(0,0,0,0.6)"
                : "rgba(255,255,255,0.85)",
            boxShadow: (theme) => theme.shadows[2],
            backdropFilter: "blur(4px)",
            ...sx,
          }}
        >
          {controlButtons}
        </Box>
      </Fade>
    );
  }

  return (
    <Fade in={isBinaryEnvironment}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar - 1,
          backgroundColor: "background.default",
          borderBottom: "1px solid",
          borderColor: "divider",
          display: { xs: "none", md: "block" },
          ...sx,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 1,
            mx: "auto",
            maxWidth: 1200,
            px: 2,
            py: 1,
          }}
        >
          {controlButtons}
        </Box>
      </Box>
    </Fade>
  );
}
