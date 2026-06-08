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
  Divider,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

const METAFIELD_NAMESPACE = "custom";
const METAFIELD_KEY = "variant_specs_json";

const SPEC_CATEGORY_OPTIONS = [
  { label: "Item Details", value: "ITEM DETAILS" },
  { label: "Diamond Details", value: "DIAMOND DETAILS" },
  {
    label: "Side Diamond Details",
    value: "SIDE DIAMOND DETAILS (IF APPLICABLE)",
  },
];

const POSITION_OPTIONS = [
  { label: "Bottom of product", value: "bottom" },
  { label: "Right side of product", value: "right" },
  { label: "Hidden", value: "hidden" },
];

const STYLE_OPTIONS = [
  { label: "Accordion / Collapsible", value: "accordion" },
  { label: "Always open", value: "open" },
  { label: "Card design", value: "card" },
  { label: "Tab item", value: "tab" },
];

const DEFAULT_DISPLAY = {
  description: { position: "bottom", style: "open" },
  benefits: { position: "right", style: "card" },
  specs: { position: "bottom", style: "accordion" },
  materials: { position: "bottom", style: "accordion" },
  technicalDetails: { position: "bottom", style: "accordion" },
  gallery: { position: "bottom", style: "card" },
  video: { position: "bottom", style: "card" },
  certificate: { position: "bottom", style: "card" },
  shipping: { position: "bottom", style: "accordion" },
  care: { position: "bottom", style: "accordion" },
  faqs: { position: "bottom", style: "accordion" },
};

const DEFAULT_CONTENT = {
  descriptionHtml: "",
  benefits: [{ title: "", text: "", icon: "💎", image: "" }],
  specs: [
    { category: "ITEM DETAILS", label: "SKU", value: "" },
    { category: "ITEM DETAILS", label: "Gender", value: "" },
    { category: "ITEM DETAILS", label: "Style", value: "" },
    { category: "DIAMOND DETAILS", label: "Diamond Type", value: "" },
    { category: "DIAMOND DETAILS", label: "Color", value: "" },
    { category: "DIAMOND DETAILS", label: "Clarity", value: "" },
    { category: "DIAMOND DETAILS", label: "Carat", value: "" },
    { category: "DIAMOND DETAILS", label: "Certification", value: "" },
    { category: "DIAMOND DETAILS", label: "Shape", value: "" },
    {
      category: "SIDE DIAMOND DETAILS (IF APPLICABLE)",
      label: "Stone Type",
      value: "",
    },
    {
      category: "SIDE DIAMOND DETAILS (IF APPLICABLE)",
      label: "Clarity",
      value: "",
    },
    {
      category: "SIDE DIAMOND DETAILS (IF APPLICABLE)",
      label: "Setting",
      value: "",
    },
  ],
  materials: [{ label: "", value: "" }],
  technicalDetails: [{ label: "", value: "" }],
  gallery: [],
  videoUrl: "",
  pdfUrl: "",
  shippingInfoHtml: "",
  careInstructionsHtml: "",
  faqs: [{ question: "", answerHtml: "" }],
  display: DEFAULT_DISPLAY,
};

const normalizeContent = (data) => {
  if (Array.isArray(data)) {
    return { ...DEFAULT_CONTENT, specs: data };
  }

  return {
    ...DEFAULT_CONTENT,
    ...data,
    benefits: Array.isArray(data?.benefits)
      ? data.benefits
      : DEFAULT_CONTENT.benefits,
    specs: Array.isArray(data?.specs) ? data.specs : DEFAULT_CONTENT.specs,
    materials: Array.isArray(data?.materials)
      ? data.materials
      : DEFAULT_CONTENT.materials,
    technicalDetails: Array.isArray(data?.technicalDetails)
      ? data.technicalDetails
      : DEFAULT_CONTENT.technicalDetails,
    gallery: Array.isArray(data?.gallery) ? data.gallery : [],
    faqs: Array.isArray(data?.faqs) ? data.faqs : DEFAULT_CONTENT.faqs,
    display: {
      ...DEFAULT_DISPLAY,
      ...(data?.display || {}),
    },
  };
};

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      products(first: 30) {
        nodes {
          id
          title
          variants(first: 100) {
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
    products: data?.data?.products?.nodes || [],
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const variantId = formData.get("variantId");
  const content = formData.get("content");

  if (!variantId) {
    return { success: false, errors: [{ message: "No variant selected." }] };
  }

  const response = await admin.graphql(
    `
      mutation SaveVariantContent($metafields: [MetafieldsSetInput!]!) {
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
            value: content || "{}",
          },
        ],
      },
    },
  );

  const data = await response.json();
  const errors = data?.data?.metafieldsSet?.userErrors || [];

  return {
    success: errors.length === 0,
    errors,
  };
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function RichTextEditor({ label, value, onChange }) {
  const editorRef = React.useRef(null);

  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const runCommand = (command, commandValue = null) => {
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "");
  };

  const addLink = () => {
    const url = window.prompt("Enter link URL");
    if (url) runCommand("createLink", url);
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await fileToDataUrl(file);
    runCommand("insertImage", dataUrl);
    event.target.value = "";
  };

  const handlePaste = async (event) => {
    const items = event.clipboardData?.items || [];

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        const dataUrl = await fileToDataUrl(file);
        runCommand("insertImage", dataUrl);
        return;
      }
    }
  };

  return (
    <BlockStack gap="200">
      <Text variant="headingSm">{label}</Text>

      <InlineStack gap="200">
        <Button onClick={() => runCommand("bold")}>Bold</Button>
        <Button onClick={() => runCommand("italic")}>Italic</Button>
        <Button onClick={() => runCommand("underline")}>Underline</Button>
        <Button onClick={() => runCommand("insertUnorderedList")}>Bullets</Button>
        <Button onClick={() => runCommand("insertOrderedList")}>Number List</Button>
        <Button onClick={addLink}>Link</Button>

        <label>
          <input
            type="file"
            accept="image/*"
            onChange={uploadImage}
            style={{ display: "none" }}
          />
          <span
            style={{
              display: "inline-flex",
              padding: "7px 12px",
              border: "1px solid #c9cccf",
              borderRadius: "8px",
              cursor: "pointer",
              background: "#fff",
            }}
          >
            Upload Image
          </span>
        </label>
      </InlineStack>

      <div
        ref={editorRef}
        contentEditable
        onInput={() => onChange(editorRef.current?.innerHTML || "")}
        onPaste={handlePaste}
        style={{
          minHeight: "160px",
          padding: "14px",
          border: "1px solid #c9cccf",
          borderRadius: "10px",
          background: "#fff",
          lineHeight: "1.7",
        }}
      />
    </BlockStack>
  );
}

export default function AppIndex() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();

  const productOptions = products.map((product) => ({
    label: product.title,
    value: product.id,
  }));

  const [selectedProductId, setSelectedProductId] = React.useState(
    products[0]?.id || "",
  );

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId,
  );

  const variantOptions =
    selectedProduct?.variants?.nodes?.map((variant) => ({
      label: variant.title,
      value: variant.id,
    })) || [];

  const [selectedVariantId, setSelectedVariantId] = React.useState(
    variantOptions[0]?.value || "",
  );

  const selectedVariant = selectedProduct?.variants?.nodes?.find(
    (variant) => variant.id === selectedVariantId,
  );

  const parseContent = React.useCallback((variant) => {
    try {
      const raw = variant?.metafield?.value;
      return raw ? normalizeContent(JSON.parse(raw)) : structuredClone(DEFAULT_CONTENT);
    } catch {
      return structuredClone(DEFAULT_CONTENT);
    }
  }, []);

  const [content, setContent] = React.useState(() => parseContent(selectedVariant));

  const [adminOpenSections, setAdminOpenSections] = React.useState({
    description: true,
    benefits: false,
    specs: true,
    materials: false,
    technicalDetails: false,
    gallery: false,
    video: false,
    shipping: false,
    care: false,
    faqs: false,
  });

  React.useEffect(() => {
    setSelectedVariantId(selectedProduct?.variants?.nodes?.[0]?.id || "");
  }, [selectedProductId, selectedProduct]);

  React.useEffect(() => {
    setContent(parseContent(selectedVariant));
  }, [selectedVariantId, selectedVariant, parseContent]);

  const updateContent = (key, value) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const updateDisplay = (key, field, value) => {
    setContent((prev) => ({
      ...prev,
      display: {
        ...prev.display,
        [key]: {
          ...(prev.display?.[key] || DEFAULT_DISPLAY[key]),
          [field]: value,
        },
      },
    }));
  };

  const updateArrayItem = (key, index, field, value) => {
    setContent((prev) => {
      const updated = [...prev[key]];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, [key]: updated };
    });
  };

  const addArrayItem = (key, item) => {
    setContent((prev) => ({ ...prev, [key]: [...prev[key], item] }));
  };

  const removeArrayItem = (key, index) => {
    setContent((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const addGalleryImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await fileToDataUrl(file);
    updateContent("gallery", [...content.gallery, dataUrl]);
    event.target.value = "";
  };

  const saveContent = () => {
    fetcher.submit(
      {
        variantId: selectedVariantId,
        content: JSON.stringify(content),
      },
      { method: "POST" },
    );
  };

  const toggleAdminSection = (key) => {
    setAdminOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const Section = ({ title, sectionKey, children }) => (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300" blockAlign="center">
            <Button variant="plain" onClick={() => toggleAdminSection(sectionKey)}>
              {adminOpenSections[sectionKey] ? "▼" : "▶"}
            </Button>

            <Text variant="headingLg">{title}</Text>
          </InlineStack>

          <InlineStack gap="300">
            <div style={{ width: 210 }}>
              <Select
                label="Position"
                options={POSITION_OPTIONS}
                value={content.display?.[sectionKey]?.position || "bottom"}
                onChange={(value) => updateDisplay(sectionKey, "position", value)}
              />
            </div>

            <div style={{ width: 210 }}>
              <Select
                label="Display style"
                options={STYLE_OPTIONS}
                value={content.display?.[sectionKey]?.style || "accordion"}
                onChange={(value) => updateDisplay(sectionKey, "style", value)}
              />
            </div>
          </InlineStack>
        </InlineStack>

        {adminOpenSections[sectionKey] && (
          <>
            <Divider />
            {children}
          </>
        )}
      </BlockStack>
    </Card>
  );

  const groupedSpecs = content.specs.reduce((acc, spec, index) => {
    const category = spec.category || "ITEM DETAILS";
    if (!acc[category]) acc[category] = [];
    acc[category].push({ ...spec, originalIndex: index });
    return acc;
  }, {});

  return (
    <div style={{ background: "#F8FAFC", paddingBottom: 32 }}>
      <Page title="Variant Content Manager">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <div
                style={{
                  background: "linear-gradient(135deg,#1D4ED8,#2563EB,#60A5FA)",
                  borderRadius: 22,
                  padding: 34,
                  color: "#fff",
                }}
              >
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <h1 style={{ fontSize: 34, margin: 0 }}>
                      Variant Content Manager
                    </h1>
                    <Text as="p">
                      Control every variant section with position and display style.
                    </Text>
                  </BlockStack>
                </InlineStack>
              </div>

              <Card>
                <BlockStack gap="400">
                  <Text variant="headingLg">Product workspace</Text>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                      gap: 16,
                    }}
                  >
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
                  </div>
                </BlockStack>
              </Card>

              <Section title="Rich Variant Description" sectionKey="description">
                <RichTextEditor
                  label="Description"
                  value={content.descriptionHtml}
                  onChange={(value) => updateContent("descriptionHtml", value)}
                />
              </Section>

              <Section title="Benefits" sectionKey="benefits">
                <BlockStack gap="300">
                  {content.benefits.map((benefit, index) => (
                    <Card key={index}>
                      <BlockStack gap="300">
                        <InlineStack gap="300">
                          <div style={{ flex: 0.3 }}>
                            <TextField
                              label="Icon"
                              value={benefit.icon}
                              onChange={(value) =>
                                updateArrayItem("benefits", index, "icon", value)
                              }
                            />
                          </div>

                          <div style={{ flex: 1 }}>
                            <TextField
                              label="Title"
                              value={benefit.title}
                              onChange={(value) =>
                                updateArrayItem("benefits", index, "title", value)
                              }
                            />
                          </div>
                        </InlineStack>

                        <TextField
                          label="Text"
                          multiline={2}
                          value={benefit.text}
                          onChange={(value) =>
                            updateArrayItem("benefits", index, "text", value)
                          }
                        />

                        <TextField
                          label="Image URL"
                          value={benefit.image}
                          onChange={(value) =>
                            updateArrayItem("benefits", index, "image", value)
                          }
                        />

                        {benefit.image && (
                          <img
                            src={benefit.image}
                            alt=""
                            style={{
                              width: 100,
                              height: 100,
                              objectFit: "cover",
                              borderRadius: 12,
                            }}
                          />
                        )}

                        <Button
                          tone="critical"
                          onClick={() => removeArrayItem("benefits", index)}
                        >
                          Remove Benefit
                        </Button>
                      </BlockStack>
                    </Card>
                  ))}

                  <Button
                    onClick={() =>
                      addArrayItem("benefits", {
                        title: "",
                        text: "",
                        icon: "✨",
                        image: "",
                      })
                    }
                  >
                    Add Benefit
                  </Button>
                </BlockStack>
              </Section>

              <Section title="Specifications Table" sectionKey="specs">
                <BlockStack gap="400">
                  {SPEC_CATEGORY_OPTIONS.map((categoryOption) => {
                    const categorySpecs = groupedSpecs[categoryOption.value] || [];

                    return (
                      <Card key={categoryOption.value}>
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="050">
                              <Text variant="headingMd">{categoryOption.label}</Text>
                              <Text tone="subdued">
                                {categorySpecs.length} fields in this category
                              </Text>
                            </BlockStack>

                            <Button
                              onClick={() =>
                                addArrayItem("specs", {
                                  category: categoryOption.value,
                                  label: "",
                                  value: "",
                                })
                              }
                            >
                              Add Field
                            </Button>
                          </InlineStack>

                          <Divider />

                          <BlockStack gap="300">
                            {categorySpecs.map((spec) => (
                              <Box
                                key={spec.originalIndex}
                                padding="300"
                                background="bg-surface-secondary"
                                borderRadius="300"
                              >
                                <InlineStack gap="300" blockAlign="end" wrap={false}>
                                  <div style={{ flex: 1 }}>
                                    <Select
                                      label="Category"
                                      options={SPEC_CATEGORY_OPTIONS}
                                      value={spec.category}
                                      onChange={(value) =>
                                        updateArrayItem(
                                          "specs",
                                          spec.originalIndex,
                                          "category",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div style={{ flex: 1 }}>
                                    <TextField
                                      label="Field Name"
                                      value={spec.label}
                                      onChange={(value) =>
                                        updateArrayItem(
                                          "specs",
                                          spec.originalIndex,
                                          "label",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div style={{ flex: 1 }}>
                                    <TextField
                                      label="Value"
                                      value={spec.value}
                                      onChange={(value) =>
                                        updateArrayItem(
                                          "specs",
                                          spec.originalIndex,
                                          "value",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <Button
                                    tone="critical"
                                    onClick={() =>
                                      removeArrayItem("specs", spec.originalIndex)
                                    }
                                  >
                                    Remove
                                  </Button>
                                </InlineStack>
                              </Box>
                            ))}
                          </BlockStack>
                        </BlockStack>
                      </Card>
                    );
                  })}
                </BlockStack>
              </Section>

              <Section title="Materials / Ingredients" sectionKey="materials">
                <BlockStack gap="300">
                  {content.materials.map((item, index) => (
                    <InlineStack gap="300" blockAlign="end" key={index}>
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Label"
                          value={item.label}
                          onChange={(value) =>
                            updateArrayItem("materials", index, "label", value)
                          }
                        />
                      </div>

                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Value"
                          value={item.value}
                          onChange={(value) =>
                            updateArrayItem("materials", index, "value", value)
                          }
                        />
                      </div>

                      <Button
                        tone="critical"
                        onClick={() => removeArrayItem("materials", index)}
                      >
                        Remove
                      </Button>
                    </InlineStack>
                  ))}

                  <Button
                    onClick={() =>
                      addArrayItem("materials", { label: "", value: "" })
                    }
                  >
                    Add Material
                  </Button>
                </BlockStack>
              </Section>

              <Section title="Technical / Nutrition Details" sectionKey="technicalDetails">
                <BlockStack gap="300">
                  {content.technicalDetails.map((item, index) => (
                    <InlineStack gap="300" blockAlign="end" key={index}>
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Label"
                          value={item.label}
                          onChange={(value) =>
                            updateArrayItem("technicalDetails", index, "label", value)
                          }
                        />
                      </div>

                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Value"
                          value={item.value}
                          onChange={(value) =>
                            updateArrayItem("technicalDetails", index, "value", value)
                          }
                        />
                      </div>

                      <Button
                        tone="critical"
                        onClick={() => removeArrayItem("technicalDetails", index)}
                      >
                        Remove
                      </Button>
                    </InlineStack>
                  ))}

                  <Button
                    onClick={() =>
                      addArrayItem("technicalDetails", { label: "", value: "" })
                    }
                  >
                    Add Row
                  </Button>
                </BlockStack>
              </Section>

              <Section title="Image Gallery" sectionKey="gallery">
                <BlockStack gap="300">
                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={addGalleryImage}
                      style={{ display: "none" }}
                    />
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "10px 14px",
                        background: "#2563EB",
                        color: "#fff",
                        borderRadius: 10,
                        cursor: "pointer",
                      }}
                    >
                      Upload Gallery Image
                    </span>
                  </label>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {content.gallery.map((image, index) => (
                      <div key={index}>
                        <img
                          src={image}
                          alt=""
                          style={{
                            width: 110,
                            height: 110,
                            objectFit: "cover",
                            borderRadius: 12,
                            border: "1px solid #DBEAFE",
                          }}
                        />
                        <br />
                        <Button
                          tone="critical"
                          onClick={() => removeArrayItem("gallery", index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </BlockStack>
              </Section>

              <Section title="Video" sectionKey="video">
                <TextField
                  label="Video URL"
                  value={content.videoUrl}
                  onChange={(value) => updateContent("videoUrl", value)}
                />
              </Section>

              <Section title="PDF / Certificate" sectionKey="certificate">
                <TextField
                  label="PDF / Certificate URL"
                  value={content.pdfUrl}
                  onChange={(value) => updateContent("pdfUrl", value)}
                />
              </Section>

              <Section title="Shipping Information" sectionKey="shipping">
                <RichTextEditor
                  label="Shipping Info"
                  value={content.shippingInfoHtml}
                  onChange={(value) => updateContent("shippingInfoHtml", value)}
                />
              </Section>

              <Section title="Care Instructions" sectionKey="care">
                <RichTextEditor
                  label="Care Instructions"
                  value={content.careInstructionsHtml}
                  onChange={(value) => updateContent("careInstructionsHtml", value)}
                />
              </Section>

              <Section title="FAQ" sectionKey="faqs">
                <BlockStack gap="300">
                  {content.faqs.map((faq, index) => (
                    <Card key={index}>
                      <BlockStack gap="300">
                        <TextField
                          label="Question"
                          value={faq.question}
                          onChange={(value) =>
                            updateArrayItem("faqs", index, "question", value)
                          }
                        />

                        <RichTextEditor
                          label="Answer"
                          value={faq.answerHtml}
                          onChange={(value) =>
                            updateArrayItem("faqs", index, "answerHtml", value)
                          }
                        />

                        <Button
                          tone="critical"
                          onClick={() => removeArrayItem("faqs", index)}
                        >
                          Remove FAQ
                        </Button>
                      </BlockStack>
                    </Card>
                  ))}

                  <Button
                    onClick={() =>
                      addArrayItem("faqs", { question: "", answerHtml: "" })
                    }
                  >
                    Add FAQ
                  </Button>
                </BlockStack>
              </Section>

              <div
                style={{
                  position: "sticky",
                  bottom: 18,
                  zIndex: 20,
                  border: "1px solid #BFDBFE",
                  borderRadius: 18,
                  background: "rgba(255,255,255,.94)",
                  boxShadow: "0 18px 45px rgba(15,23,42,.12)",
                  padding: 16,
                }}
              >
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd">Save variant content</Text>
                    <Text tone="subdued">
                      Product: {selectedProduct?.title || "No product"} · Variant:{" "}
                      {selectedVariant?.title || "No variant"}
                    </Text>
                  </BlockStack>

                  <Button
                    variant="primary"
                    size="large"
                    loading={fetcher.state === "submitting"}
                    onClick={saveContent}
                    disabled={!selectedVariantId}
                  >
                    Save Variant Content
                  </Button>
                </InlineStack>

                {fetcher.data?.success && (
                  <Box paddingBlockStart="300">
                    <Text tone="success">Saved successfully ✅</Text>
                  </Box>
                )}

                {fetcher.data?.errors?.length > 0 && (
                  <Box paddingBlockStart="300">
                    <Text tone="critical">{fetcher.data.errors[0].message}</Text>
                  </Box>
                )}
              </div>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>
    </div>
  );
}