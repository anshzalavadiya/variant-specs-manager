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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

const METAFIELD_NAMESPACE = "custom";
const METAFIELD_KEY = "variant_specs_json";

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

const defaultSpecs = [
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
  const getSpecs = () => {
    try {
      return selectedVariant?.metafield?.value
        ? JSON.parse(selectedVariant.metafield.value)
        : defaultSpecs;
    } catch {
      return defaultSpecs;
    }
  };

  const [specs, setSpecs] = React.useState(getSpecs());

  React.useEffect(() => {
    setSelectedVariantId(
      selectedProduct?.variants.nodes[0]?.id || ""
    );
  }, [selectedProductId]);

  React.useEffect(() => {
    setSpecs(getSpecs());
  }, [selectedVariantId]);

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
    fetcher.submit(
      {
        variantId: selectedVariantId,
        specs: JSON.stringify(specs),
      },
      { method: "POST" }
    );
  };

  return (
    <Page title="Variant Specs Manager">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
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

              <Text variant="headingMd">Variant Specification Fields</Text>
<Text tone="subdued">
  Select category, then add field name and value.
</Text>

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
  onChange={(value) => updateSpec(index, "category", value)}
/>
                    <TextField
                      label="Field Name"
                      value={spec.label}
                      onChange={(value) =>
                        updateSpec(index, "label", value)
                      }
                    />
                    
                  </div>

                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Value"
                      value={spec.value}
                      onChange={(value) =>
                        updateSpec(index, "value", value)
                      }
                    />
                  </div>

                  <Button
                    tone="critical"
                    onClick={() => removeField(index)}
                  >
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
                >
                  Save Variant Specs
                </Button>
              </InlineStack>

              {fetcher.data?.success && (
                <Text tone="success">Saved successfully ✅</Text>
              )}

              {fetcher.data?.errors?.length > 0 && (
                <Text tone="critical">
                  {fetcher.data.errors[0].message}
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}