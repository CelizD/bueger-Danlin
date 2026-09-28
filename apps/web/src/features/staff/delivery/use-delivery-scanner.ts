"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type ScannerControls = {
  stop: () => void;
};

export function useDeliveryScanner(
  onScan: (payload: string) => Promise<void>,
  onError: (message: string) => void,
) {
  const [scannerOpen, setScannerOpen] =
    useState(false);
  const videoRef =
    useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef =
    useRef<ScannerControls | null>(null);
  const processingScanRef =
    useRef(false);

  useEffect(() => {
    if (
      !scannerOpen ||
      !videoRef.current
    ) {
      return;
    }

    let disposed = false;

    void import("@zxing/browser")
      .then(
        ({
          BrowserQRCodeReader,
        }) => {
          if (
            disposed ||
            !videoRef.current
          ) {
            return undefined;
          }

          const reader =
            new BrowserQRCodeReader();

          return reader.decodeFromVideoDevice(
            undefined,
            videoRef.current,
            (
              result,
              _error,
              controls,
            ) => {
              if (
                !result ||
                disposed ||
                processingScanRef.current
              ) {
                return;
              }

              processingScanRef.current =
                true;
              controls.stop();
              setScannerOpen(false);

              void onScan(
                result.getText(),
              ).finally(() => {
                processingScanRef.current =
                  false;
              });
            },
          );
        },
      )
      .then((controls) => {
        if (!controls) {
          return;
        }

        if (disposed) {
          controls.stop();
          return;
        }

        scannerControlsRef.current =
          controls;
      })
      .catch((cameraError) => {
        if (disposed) {
          return;
        }

        setScannerOpen(false);
        onError(
          cameraError instanceof Error
            ? `No se pudo abrir la cámara: ${cameraError.message}`
            : "No se pudo abrir la cámara.",
        );
      });

    return () => {
      disposed = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [scannerOpen]);

  function openScanner() {
    setScannerOpen(true);
  }

  function closeScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScannerOpen(false);
  }

  return {
    scannerOpen,
    videoRef,
    openScanner,
    closeScanner,
  };
}
