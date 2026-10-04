"use client";

import { apiUrl } from "@/lib/api/browser";
import {
  Image as ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  useEffect,
  useState,
} from "react";
import {
  fetchAdminProducts,
  removeAdminProductImage,
  uploadAdminProductImage,
} from "./api";
import type { AdminProductImage } from "./types";

const MAX_IMAGE_BYTES =
  2 * 1024 * 1024;

const PRODUCT_TYPE_LABEL: Record<
  AdminProductImage["type"],
  string
> = {
  COMBO: "Combo",
  BEVERAGE: "Bebida",
  ADD_ON: "Extra",
};

export function ProductImageManager() {
  const [products, setProducts] =
    useState<AdminProductImage[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [busyId, setBusyId] =
    useState<string | null>(null);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");

  async function load() {
    try {
      const data =
        await fetchAdminProducts();
      setProducts(data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los productos.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function upload(
    product: AdminProductImage,
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      setError(
        "Usa una imagen JPEG, PNG o WebP.",
      );
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        "La imagen debe pesar como máximo 2 MB.",
      );
      return;
    }

    setBusyId(product.id);
    setError("");
    setSuccess("");

    try {
      await uploadAdminProductImage(
        product.id,
        file,
      );
      setSuccess(
        `Imagen de ${product.name} actualizada.`,
      );
      await load();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo subir la imagen.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(
    product: AdminProductImage,
  ) {
    if (!product.imagePath) return;

    const confirmed =
      window.confirm(
        `¿Quitar la imagen de ${product.name}?`,
      );

    if (!confirmed) return;

    setBusyId(product.id);
    setError("");
    setSuccess("");

    try {
      await removeAdminProductImage(
        product.id,
      );
      setSuccess(
        `Imagen de ${product.name} eliminada.`,
      );
      await load();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "No se pudo quitar la imagen.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="product-media-section">
      <div className="product-media-heading">
        <div>
          <p className="admin-kicker">
            Catálogo
          </p>
          <h2>Fotos de productos</h2>
          <p>
            Sube una foto para que el
            producto se vea en el menú
            del cliente. JPEG, PNG o
            WebP de hasta 2 MB.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="admin-error-banner"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div className="saturday-success">
          {success}
        </div>
      )}

      {loading ? (
        <div className="admin-empty">
          Cargando productos…
        </div>
      ) : (
        <div className="product-media-grid">
          {products.map((product) => (
            <article
              className="product-media-card"
              key={product.id}
            >
              <div className="product-media-preview">
                {product.imagePath ? (
                  <img
                    src={apiUrl(
                      product.imagePath,
                    )}
                    alt={product.name}
                  />
                ) : (
                  <div className="product-media-placeholder">
                    <ImageIcon
                      size={28}
                      aria-hidden="true"
                    />
                    <span>Sin foto</span>
                  </div>
                )}
              </div>

              <div className="product-media-info">
                <span>
                  {
                    PRODUCT_TYPE_LABEL[
                      product.type
                    ]
                  }
                  {!product.active
                    ? " · Inactivo"
                    : ""}
                </span>
                <strong>
                  {product.name}
                </strong>
              </div>

              <div className="product-media-actions">
                <label
                  className="product-media-upload"
                  aria-disabled={
                    busyId === product.id
                  }
                >
                  <Upload
                    size={15}
                    aria-hidden="true"
                  />
                  {product.imagePath
                    ? "Cambiar foto"
                    : "Subir foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={
                      busyId ===
                      product.id
                    }
                    onChange={(event) => {
                      void upload(
                        product,
                        event,
                      );
                    }}
                  />
                </label>

                {product.imagePath && (
                  <button
                    type="button"
                    className="product-media-remove"
                    disabled={
                      busyId ===
                      product.id
                    }
                    onClick={() => {
                      void remove(
                        product,
                      );
                    }}
                  >
                    <Trash2
                      size={15}
                      aria-hidden="true"
                    />
                    Quitar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
