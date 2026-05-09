"use server";

import { createClient } from "@/utils/supabase/server";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateProfile({ fullName }: { fullName: string }) {
	const session = await auth();
	if (!session.data.user) {
		return { error: "No estÃ¡s autenticado." };
	}
	const supabase = await createClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return { error: "No estás autenticado." };
	}

	const { error } = await supabase
		.from("profiles")
		.update({
			full_name: fullName.trim() || null,
		})
		.eq("user_id", user.id);

	if (error) {
		console.error("[profile] updateProfile error", error);
		return { error: "No se pudo actualizar el perfil." };
	}

	revalidatePath("/profile");

	return { success: true };
}

export async function updateEmail({ email }: { email: string }) {
	const session = await auth();
	if (!session.data.user) {
		return { error: "No estÃ¡s autenticado." };
	}
	const supabase = await createClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return { error: "No estás autenticado." };
	}

	const { error } = await supabase.auth.updateUser({
		email: email.trim(),
	});

	if (error) {
		console.error("[profile] updateEmail error", error);
		return { error: "No se pudo actualizar el email." };
	}

	revalidatePath("/profile");

	return {
		success: true,
		// Supabase normalmente envía un mail de confirmación
		message: "Te enviamos un correo para confirmar el cambio de email.",
	};
}

export async function updatePassword({ password }: { password: string }) {
	const session = await auth();
	if (!session.data.user) {
		return { error: "No estÃ¡s autenticado." };
	}
	const supabase = await createClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return { error: "No estás autenticado." };
	}

	const { error } = await supabase.auth.updateUser({
		password,
	});

	if (error) {
		console.error("[profile] updatePassword error", error);
		return { error: "No se pudo actualizar la contraseña." };
	}

	return { success: true };
}
