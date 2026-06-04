import React from "react";
import { useFetcher, useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Select,
  Text,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

const METAFIELD_NAMESPACE = "custom";
const METAFIELD_KEY = "variant_specs_json";

const DEFAULT_SPECS = [
  { category: "ITEM DETAILS", label: "SKU", value: "" },
  { category: "ITEM DETAILS", label: "Gender", value: "" },
  { category: "ITEM DETAILS", label: "Style", value: "" },
  { category: "DIAMOND DETAILS", label: "Diamond Type", value: "" },
  { category: "DIAMOND DETAILS", label: "Color", value: "" },
  { category: "DIAMOND DETAILS", label: "Clarity", value: "" },
  { category: "DIAMOND DETAILS", label: "Carat", value: "" },
  { category: "DIAMOND DETAILS", label: "Certification", value: "" },
  { category: "DIAMOND DETAILS", label: "Shape", value: "" },
  { category: "SIDE DIAMOND DETAILS (IF APPLICABLE)", label: "Stone Type", value: "" },
  { category: "SIDE DIAMOND DETAILS (IF APPLICABLE)", label: "Clarity", value: "" },
  { category: "SIDE DIAMOND DETAILS (IF APPLICABLE)", label: "Setting", value: "" },
];

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      products(first: 20) {
        nodes {
          id
          title
          variants(first: 50) {
            nodes {
              id
              title
              metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
                id
                value
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();

  return {
    products: data.data.products.nodes,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const actionType = formData.get("actionType");

  if (actionType === "bulkSave") {
    const payload = JSON.parse(formData.get("payload") || "[]");

    const metafields = payload.map((item) => ({
      ownerId: item.variantId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEY,
      type: "json",
      value: JSON.stringify(item.specs),
    }));

    const allErrors = [];

    for (let i = 0; i < metafields.length; i += 25) {
      const chunk = metafields.slice(i, i + 25);

      const response = await admin.graphql(
        `
          mutation SaveVariantSpecs($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
                key
                value
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          variables: {
            metafields: chunk,
          },
        }
      );

      const data = await response.json();
      allErrors.push(...data.data.metafieldsSet.userErrors);
    }

    return {
      success: allErrors.length === 0,
      errors: allErrors,
      bulkSaved: true,
      count: payload.length,
    };
  }

  const variantId = formData.get("variantId");
  const specs = formData.get("specs");

  const response = await admin.graphql(
    `
      mutation SaveVariantSpecs($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: variantId,
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: "json",
            value: specs,
          },
        ],
      },
    }
  );

  const data = await response.json();

  return {
    success: data.data.metafieldsSet.userErrors.length === 0,
    errors: data.data.metafieldsSet.userErrors,
  };
};

export default function AppIndex() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();

  const fileInputRef = React.useRef(null);
  const excelInputRef = React.useRef(null);

  const productOptions = products.map((product) => ({
    label: product.title,
    value: product.id,
  }));

  const firstProduct = products[0];

  const [selectedProductId, setSelectedProductId] = React.useState(
    firstProduct?.id || ""
  );

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId
  );

  const variantOptions =
    selectedProduct?.variants.nodes.map((variant) => ({
      label: variant.title,
      value: variant.id,
    })) || [];

  const [selectedVariantId, setSelectedVariantId] = React.useState(
    variantOptions[0]?.value || ""
  );

  const selectedVariant = selectedProduct?.variants.nodes.find(
    (variant) => variant.id === selectedVariantId
  );

  const parseSpecs = (variant) => {
    try {
      return variant?.metafield?.value
        ? JSON.parse(variant.metafield.value)
        : DEFAULT_SPECS.map((item) => ({ ...item }));
    } catch {
      return DEFAULT_SPECS.map((item) => ({ ...item }));
    }
  };

  const getSpecs = () => parseSpecs(selectedVariant);

  const [specs, setSpecs] = React.useState(getSpecs());
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const [imageLoading, setImageLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState("");
  const [selectedImage, setSelectedImage] = React.useState(null);
  const [imagePreview, setImagePreview] = React.useState("");
  const [excelMessage, setExcelMessage] = React.useState("");

  React.useEffect(() => {
    setSelectedVariantId(selectedProduct?.variants.nodes[0]?.id || "");
  }, [selectedProductId]);

  React.useEffect(() => {
    setSpecs(getSpecs());
  }, [selectedVariantId]);

  const safeJsonFetch = async (url, options) => {
    const response = await fetch(url, options);
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        "API route returned HTML instead of JSON. Check api route file name and restart app."
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Something went wrong");
    }

    return data;
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        resolve(result.split(",")[1]);
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const setImageFile = (file) => {
    if (!file) return;

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    setAiError("");
  };

  const generateWithTextAI = async () => {
    setAiLoading(true);
    setAiError("");

    try {
      const data = await safeJsonFetch("/api/ai-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productTitle: selectedProduct?.title || "",
          variantTitle: selectedVariant?.title || "",
          userPrompt: aiPrompt,
          currentSpecs: specs,
        }),
      });

      setSpecs(data.specs);
    } catch (error) {
      setAiError(error.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const analyzeSelectedImageWithAI = async () => {
    if (!selectedImage) {
      setAiError("No image selected. Upload or paste image first.");
      return;
    }

    setImageLoading(true);
    setAiError("");

    try {
      const base64Image = await fileToBase64(selectedImage);

      const data = await safeJsonFetch("/api/ai-analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: base64Image,
          mimeType: selectedImage.type || "image/jpeg",
          productTitle: selectedProduct?.title || "",
          variantTitle: selectedVariant?.title || "",
          userPrompt: aiPrompt || "",
          currentSpecs: specs,
        }),
      });

      setSpecs(data.specs);
    } catch (error) {
      setAiError(error.message || "Image analysis failed");
    } finally {
      setImageLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    setImageFile(file);
    event.target.value = "";
  };

  const handlePasteImage = (event) => {
    const items = event.clipboardData?.items || [];
    let foundImage = false;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        setImageFile(file);
        foundImage = true;
        break;
      }
    }

    if (!foundImage) {
      setAiError("No image found in clipboard. Copy image first, then paste here.");
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview("");
  };

  const updateSpec = (index, field, value) => {
    const updated = [...specs];
    updated[index][field] = value;
    setSpecs(updated);
  };

  const addField = () => {
    setSpecs([
      ...specs,
      {
        category: "DIAMOND DETAILS",
        label: "",
        value: "",
      },
    ]);
  };

  const removeField = (index) => {
    setSpecs(specs.filter((_, i) => i !== index));
  };

  const saveSpecs = () => {
    const currentKey = `${selectedProduct?.title}|||${selectedVariant?.title}`.toLowerCase();
const currentVariantData = variantMap.get(currentKey);

if (currentVariantData) {
  setSpecs(currentVariantData.specs);
}
    fetcher.submit(
      {
        variantId: selectedVariantId,
        specs: JSON.stringify(specs),
      },
      { method: "POST" }
    );
  };

  const downloadExcelFormat = async () => {
    const XLSX = await import("xlsx");

    const rows = [];

    products.forEach((product) => {
      product.variants.nodes.forEach((variant) => {
        const variantSpecs = parseSpecs(variant);

        variantSpecs.forEach((spec) => {
          rows.push({
            "Product Name": product.title,
            "Product Variant Name": variant.title,
            Category: spec.category,
            "Field Name": spec.label,
            Value: spec.value || "",
          });
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Variant Specs");
    XLSX.writeFile(workbook, "variant-specs-format.xlsx");
  };

  const downloadCurrentVariantExcel = async () => {
    const XLSX = await import("xlsx");

    const rows = specs.map((spec) => ({
      "Product Name": selectedProduct?.title || "",
      "Product Variant Name": selectedVariant?.title || "",
      Category: spec.category,
      "Field Name": spec.label,
      Value: spec.value || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Current Variant");
    XLSX.writeFile(workbook, "current-variant-specs.xlsx");
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setExcelMessage("");

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const variantMap = new Map();

      products.forEach((product) => {
        product.variants.nodes.forEach((variant) => {
          const key = `${product.title}|||${variant.title}`.toLowerCase();
          variantMap.set(key, {
            product,
            variant,
            specs: parseSpecs(variant).map((spec) => ({ ...spec })),
          });
        });
      });

      let matchedRows = 0;
      let addedFields = 0;
      let updatedFields = 0;

      rows.forEach((row) => {
        const productName = String(row["Product Name"] || "").trim();
        const variantName = String(row["Product Variant Name"] || "").trim();
        const category = String(row["Category"] || "").trim();
        const fieldName = String(row["Field Name"] || "").trim();
        const value = String(row["Value"] || "").trim();

        if (!productName || !variantName || !category || !fieldName) return;

        const key = `${productName}|||${variantName}`.toLowerCase();
        const found = variantMap.get(key);

        if (!found) return;

        matchedRows++;

        const existingIndex = found.specs.findIndex(
          (spec) =>
            String(spec.category).toLowerCase() === category.toLowerCase() &&
            String(spec.label).toLowerCase() === fieldName.toLowerCase()
        );

        if (existingIndex >= 0) {
          found.specs[existingIndex].value = value;
          updatedFields++;
        } else {
          found.specs.push({
            category,
            label: fieldName,
            value,
          });
          addedFields++;
        }
      });

      const payload = [];

      variantMap.forEach((item) => {
        payload.push({
          variantId: item.variant.id,
          specs: item.specs,
        });
      });

      fetcher.submit(
        {
          actionType: "bulkSave",
          payload: JSON.stringify(payload),
        },
        { method: "POST" }
      );

      setExcelMessage(
        `Excel processed ✅ Matched rows: ${matchedRows}, Updated: ${updatedFields}, Added: ${addedFields}`
      );
    } catch (error) {
      setExcelMessage(error.message || "Excel upload failed");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Page title="Variant Specs Manager">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Select
                label="Select Product"
                options={productOptions}
                value={selectedProductId}
                onChange={setSelectedProductId}
              />

              <Select
                label="Select Variant"
                options={variantOptions}
                value={selectedVariantId}
                onChange={setSelectedVariantId}
              />

              <Text variant="headingMd">AI Auto Fill</Text>

              <TextField
                label="Tell AI what data to add"
                value={aiPrompt}
                onChange={setAiPrompt}
                multiline={4}
                placeholder="Example: 18K rose gold ring, lab diamond, oval shape, 1.5 carat."
              />

              <Box padding="400" background="bg-surface-secondary">
                <div
                  onPaste={handlePasteImage}
                  tabIndex={0}
                  style={{
                    border: "2px dashed #999",
                    borderRadius: "10px",
                    padding: "20px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "#fff",
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />

                  <Text variant="bodyMd">
                    Click here to upload image or paste copied image here
                  </Text>

                  <Text tone="subdued">
                    Image preview will show below.
                  </Text>
                </div>
              </Box>

              {selectedImage && (
                <BlockStack gap="200">
                  <Text tone="success">
                    Image selected ✅ {selectedImage.name || "Pasted image"}
                  </Text>

                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Selected jewellery"
                      style={{
                        width: "160px",
                        height: "160px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        border: "1px solid #ddd",
                      }}
                    />
                  )}

                  <InlineStack gap="300">
                    <Button
                      loading={imageLoading}
                      onClick={analyzeSelectedImageWithAI}
                    >
                      Analyze Image AI
                    </Button>

                    <Button onClick={clearImage}>Remove Image</Button>
                  </InlineStack>
                </BlockStack>
              )}

              <InlineStack gap="300">
                <Button loading={aiLoading} onClick={generateWithTextAI}>
                  Generate With Text AI
                </Button>
              </InlineStack>

              {aiError && <Text tone="critical">{aiError}</Text>}

              <Text variant="headingMd">Excel Upload / Download</Text>

              <Text tone="subdued">
                Excel columns: Product Name, Product Variant Name, Category,
                Field Name, Value
              </Text>

              <InlineStack gap="300">
                <Button onClick={downloadExcelFormat}>
                  Download Full Excel Format
                </Button>

                <Button onClick={downloadCurrentVariantExcel}>
                  Download Current Variant Excel
                </Button>

                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  style={{ display: "none" }}
                />

                <Button onClick={() => excelInputRef.current?.click()}>
                  Upload Excel & Save Data
                </Button>
              </InlineStack>

              {excelMessage && <Text tone="success">{excelMessage}</Text>}

              <Text variant="headingMd">Variant Specification Fields</Text>

              {specs.map((spec, index) => (
                <InlineStack gap="300" key={index} align="center">
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Category"
                      options={[
                        { label: "Item Details", value: "ITEM DETAILS" },
                        { label: "Diamond Details", value: "DIAMOND DETAILS" },
                        {
                          label: "Side Diamond Details",
                          value: "SIDE DIAMOND DETAILS (IF APPLICABLE)",
                        },
                      ]}
                      value={spec.category || "DIAMOND DETAILS"}
                      onChange={(value) =>
                        updateSpec(index, "category", value)
                      }
                    />

                    <TextField
                      label="Field Name"
                      value={spec.label}
                      onChange={(value) => updateSpec(index, "label", value)}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Value"
                      value={spec.value}
                      onChange={(value) => updateSpec(index, "value", value)}
                    />
                  </div>

                  <Button tone="critical" onClick={() => removeField(index)}>
                    Remove
                  </Button>
                </InlineStack>
              ))}

              <InlineStack gap="300">
                <Button onClick={addField}>Add Field</Button>

                <Button
                  variant="primary"
                  loading={fetcher.state === "submitting"}
                  onClick={saveSpecs}
                  disabled={!selectedVariantId}
                >
                  Save Variant Specs
                </Button>
              </InlineStack>

              {fetcher.data?.success && (
                <Text tone="success">
                  {fetcher.data?.bulkSaved
                    ? `Excel data saved successfully ✅ Variants updated: ${fetcher.data.count}`
                    : "Saved successfully ✅"}
                </Text>
              )}

              {fetcher.data?.errors?.length > 0 && (
                <Text tone="critical">{fetcher.data.errors[0].message}</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}