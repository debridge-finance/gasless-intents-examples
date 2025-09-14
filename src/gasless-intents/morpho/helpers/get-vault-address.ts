import fetch from "node-fetch";

type MorphoVaultItem = {
    address: string;
    asset?: { address: string };
    whitelisted?: boolean;
};

interface GraphQLResponse {
    data?: {
        vaults: {
            items: MorphoVaultItem[];
        };
    };
    errors?: any;
}

/**
 * Given a token's ERC-20 address and a chain ID, returns the Morpho Vault contract address
 * that corresponds to that token on that chain, if any.
 *
 * @param tokenAddress The ERC-20 token address
 * @param chainId The EVM chain id
 * @returns the vault address or null if no vault found
 */
export async function getVaultAddressByToken(
    tokenAddress: string,
    chainId: number
): Promise<string | null> {
    if (!tokenAddress) {
        throw new Error("tokenAddress is required");
    }

    const endpoint = "https://api.morpho.org/graphql";
    const normalizedToken = tokenAddress.toLowerCase();

    const query = `
    query ($chainIds: [Int!]) {
      vaults(first: 1000, where: { chainId_in: $chainIds }) {
        items {
          address
          whitelisted
          asset { address }
        }
      }
    }
  `;

    const variables = { chainIds: [chainId] };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GraphQL query failed: ${response.status} ${response.statusText}: ${errorBody}`);
    }

    const result = (await response.json()) as GraphQLResponse;

    if (result.errors) {
        throw new Error(`GraphQL returned errors: ${JSON.stringify(result.errors)}`);
    }

    const items = result.data?.vaults.items;
    if (!items || items.length === 0) {
        return null;
    }

    // Prefer whitelisted vault if it matches
    const whitelistedMatch = items.find(
        (v) =>
            v.asset?.address.toLowerCase() === normalizedToken &&
            v.whitelisted === true
    );
    if (whitelistedMatch) {
        return whitelistedMatch.address;
    }

    // Otherwise take the first match
    const anyMatch = items.find(
        (v) => v.asset?.address.toLowerCase() === normalizedToken
    );
    return anyMatch ? anyMatch.address : null;
}