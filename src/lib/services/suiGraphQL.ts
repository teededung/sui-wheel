/**
 * Sui GraphQL Service
 * Provides GraphQL client for querying Sui blockchain data
 * @see https://sdk.mystenlabs.com/typescript/graphql
 */

import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { graphql } from '@mysten/sui/graphql/schemas/latest';

// ========================================================================
// GraphQL Client Configuration
// ========================================================================

// Official Sui GraphQL endpoints
const GRAPHQL_ENDPOINTS = {
	mainnet: 'https://graphql.mainnet.sui.io/graphql',
	testnet: 'https://graphql.testnet.sui.io/graphql',
	devnet: 'https://graphql.devnet.sui.io/graphql'
} as const;

export type SuiNetwork = keyof typeof GRAPHQL_ENDPOINTS;

/**
 * Creates a Sui GraphQL client for the specified network
 */
function createSuiGraphQLClient(network: SuiNetwork = 'mainnet'): SuiGraphQLClient {
	return new SuiGraphQLClient({
		url: GRAPHQL_ENDPOINTS[network]
	});
}

// ========================================================================
// Pre-built Queries
// ========================================================================

/**
 * Query to get object by ID
 */
const getObjectQuery = graphql(`
	query GetObject($id: SuiAddress!) {
		object(address: $id) {
			address
			version
			digest
			owner {
				__typename
				... on AddressOwner {
					address {
						address
					}
				}
				... on Shared {
					initialSharedVersion
				}
			}
			previousTransaction {
				digest
				effects {
					timestamp
				}
			}
			asMoveObject {
				contents {
					type {
						repr
					}
					json
				}
			}
		}
	}
`);

/**
 * Query to get transactions by Move function call
 * @see https://docs.sui.io/concepts/graphql-rpc
 * Function filter format: "package::module::function" or "package::module" or "package"
 */
const getTransactionsByFunctionQuery = graphql(`
	query GetTransactionsByFunction($function: String!, $last: Int) {
		transactions(last: $last, filter: { function: $function }) {
			pageInfo {
				hasNextPage
				endCursor
			}
			nodes {
				digest
				sender {
					address
				}
				effects {
					status
					timestamp
					objectChanges {
						nodes {
							idCreated
							idDeleted
							inputState {
								address
								asMoveObject {
									contents {
										type {
											repr
										}
									}
								}
							}
							outputState {
								address
								asMoveObject {
									contents {
										type {
											repr
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
`);

/**
 * Query to get transactions by sender and Move function call
 * @see https://docs.sui.io/concepts/graphql-rpc
 * Function filter format: "package::module::function" or "package::module" or "package"
 */
const getTransactionsBySenderAndFunctionQuery = graphql(`
	query GetTransactionsBySenderAndFunction($sender: SuiAddress!, $function: String!, $last: Int) {
		transactions(last: $last, filter: { sentAddress: $sender, function: $function }) {
			pageInfo {
				hasNextPage
				endCursor
			}
			nodes {
				digest
				sender {
					address
				}
				effects {
					status
					timestamp
					objectChanges {
						nodes {
							idCreated
							idDeleted
							inputState {
								address
								asMoveObject {
									contents {
										type {
											repr
										}
									}
								}
							}
							outputState {
								address
								asMoveObject {
									contents {
										type {
											repr
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
`);

// ========================================================================
// Service Class
// ========================================================================

export class SuiGraphQLService {
	private client: SuiGraphQLClient;
	private network: SuiNetwork;

	constructor(network: SuiNetwork = 'mainnet') {
		this.network = network;
		this.client = createSuiGraphQLClient(network);
	}

	/**
	 * Get object by ID
	 */
	async getObject(objectId: string) {
		const result = await this.client.query({
			query: getObjectQuery,
			variables: { id: objectId }
		});
		//console.log('[suiGQL.getObject] result:', JSON.stringify(result, null, 2));
		return result.data?.object;
	}

	/**
	 * Get transactions by Move function call
	 * @param packageAddr - Package address (e.g., "0x2")
	 * @param module - Module name (e.g., "transfer")
	 * @param functionName - Function name (e.g., "public_transfer")
	 * Uses format: "package::module::function"
	 * @see https://docs.sui.io/concepts/graphql-rpc
	 */
	async getTransactionsByFunction(
		packageAddr: string,
		module: string,
		functionName: string,
		last = 30
	) {
		// Construct function path: package::module::function
		const functionPath = `${packageAddr}::${module}::${functionName}`;
		const result = await this.client.query({
			query: getTransactionsByFunctionQuery,
			variables: {
				function: functionPath,
				last
			}
		});

		if (result.errors) {
			console.error('[SuiGraphQL] GraphQL errors:', result.errors);
		}

		return result.data?.transactions;
	}

	/**
	 * Get multiple objects by IDs
	 * Uses parallel getObject calls since objectIds filter is not available in beta GraphQL
	 */
	async getMultipleObjects(ids: string[]) {
		if (ids.length === 0) return [];

		const results = await Promise.all(
			ids.map(async (id) => {
				try {
					return await this.getObject(id);
				} catch {
					return null;
				}
			})
		);

		// Filter out null results and return
		return results.filter((obj) => obj !== null);
	}

	/**
	 * Get transactions by sender address and Move function call
	 * @param sender - Sender address
	 * @param packageAddr - Package address (e.g., "0x2")
	 * @param module - Module name (e.g., "transfer")
	 * @param functionName - Function name (e.g., "public_transfer")
	 * Uses format: "package::module::function"
	 * @see https://docs.sui.io/concepts/graphql-rpc
	 */
	async getTransactionsBySenderAndFunction(
		sender: string,
		packageAddr: string,
		module: string,
		functionName: string,
		last = 50
	) {
		// Construct function path: package::module::function
		const functionPath = `${packageAddr}::${module}::${functionName}`;
		const result = await this.client.query({
			query: getTransactionsBySenderAndFunctionQuery,
			variables: {
				sender,
				function: functionPath,
				last
			}
		});

		if (result.errors) {
			console.error('[SuiGraphQL] GraphQL errors:', result.errors);
		}

		return result.data?.transactions;
	}
}

// ========================================================================
// Factory Functions
// ========================================================================

export function createGraphQLService(network: SuiNetwork = 'mainnet'): SuiGraphQLService {
	return new SuiGraphQLService(network);
}
