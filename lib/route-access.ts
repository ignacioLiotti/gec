/**
 * ============================================================================
 * ROUTE ACCESS CONTROL CONFIGURATION
 * ============================================================================
 *
 * THIS IS WHERE YOU CONFIGURE WHICH ROUTES ARE ACCESSIBLE BY WHICH ROLES
 *
 * File: lib/route-access.ts
 *
 * To add a new protected route:
 * 1. Add a new entry to ROUTE_ACCESS_CONFIG array below
 * 2. Specify the route path pattern and allowed roles
 * 3. The route will automatically be protected in middleware (if you add it back)
 * 4. The route will automatically be filtered in the sidebar
 *
 * Rules:
 * - If a route is NOT listed here, it's accessible by ALL authenticated users
 * - If a route is listed with an empty array [], it's accessible by ALL authenticated users
 * - If a route is listed with roles, ONLY those roles can access it
 * - "admin" role ALWAYS has access to everything (checked separately)
 *
 * Route matching:
 * - Exact paths: "/certificados" matches exactly "/certificados"
 * - Dynamic paths: "/excel/[obraId]" matches "/excel/anything"
 *
 * Example:
 * {
 *   path: "/admin/users",
 *   allowedRoles: ["admin"],  // Only admin role can access
 * }
 *
 * ============================================================================
 */

export type Role = "admin" | "contable" | string; // Allow any string for flexibility, but prefer "admin" | "contable"

export interface RouteAccessConfig {
	/**
	 * Route path pattern (supports dynamic segments like [obraId])
	 * Examples:
	 * - "/certificados" - exact match
	 * - "/excel/[obraId]" - matches /excel/anything
	 */
	path: string;
	/**
	 * Roles that can access this route
	 * If empty array, all authenticated users can access
	 * "admin" role always has access regardless of this list
	 */
	allowedRoles: Role[];
}

/**
 * Route access configuration
 * Add new routes here to control access
 */
export const ROUTE_ACCESS_CONFIG: RouteAccessConfig[] = [
	{
		path: "/certificados",
		allowedRoles: ["admin", "contable"],
	},
	{
		path: "/excel",
		allowedRoles: ["admin", "operativo"],
	},
	{
		path: "/excel/[obraId]",
		allowedRoles: ["admin", "contable", "operativo"],
	},
	{
		path: "/admin",
		allowedRoles: ["admin"],
	},
	{
		path: "/admin/audit-log",
		allowedRoles: ["admin"],
	},
	{
		path: "/admin/tenant-secrets",
		allowedRoles: ["admin"],
	},
	{
		path: "/admin/workflows",
		allowedRoles: ["admin"],
	},
	{
		path: "/dev",
		allowedRoles: ["admin"],
	},
	{
		path: "/workflow-test",
		allowedRoles: ["admin"],
	},
	{
		path: "/profile",
		// Perfil accesible para cualquier usuario autenticado
		allowedRoles: [],
	},
	// Add more routes as needed
	// {
	//   path: "/admin/users",
	//   allowedRoles: ["admin"],
	// },
];

/**
 * Check if a path matches a route pattern
 * Supports dynamic segments like [obraId]
 */
function matchesRoute(pattern: string, path: string): boolean {
	// Convert pattern to regex
	// [obraId] becomes a wildcard segment
	const regexPattern = pattern
		.replace(/\[.*?\]/g, "[^/]+") // Replace [param] with [^/]+
		.replace(/\//g, "\\/"); // Escape slashes

	const regex = new RegExp(`^${regexPattern}$`);
	return regex.test(path);
}

/**
 * Get the route access config for a given path
 */
export function getRouteAccessConfig(
	path: string
): RouteAccessConfig | undefined {
	return ROUTE_ACCESS_CONFIG.find((config) => matchesRoute(config.path, path));
}

/**
 * Check if a path requires access control
 */
export function isRouteProtected(path: string): boolean {
	return getRouteAccessConfig(path) !== undefined;
}
