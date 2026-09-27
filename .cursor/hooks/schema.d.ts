export declare const HooksConfig: import("arktype/internal/variants/object.ts").ObjectType<
	{
		version: number;
		hooks: {
			sessionStart?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			sessionEnd?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			preToolUse?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			postToolUse?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			postToolUseFailure?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			subagentStart?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			subagentStop?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			beforeShellExecution?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			afterShellExecution?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			beforeMCPExecution?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			afterMCPExecution?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			beforeReadFile?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			afterFileEdit?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			beforeSubmitPrompt?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			preCompact?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			stop?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			afterAgentResponse?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			afterAgentThought?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			beforeTabFileRead?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			afterTabFileEdit?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
			workspaceOpen?:
				| (
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								command: string;
								type?: "command" | undefined;
						  }
						| {
								timeout?: number | undefined;
								loop_limit?: number | null | undefined;
								failClosed?: boolean | undefined;
								matcher?: string | undefined;
								type: "prompt";
								prompt: string;
								model?: string | undefined;
						  }
				  )[]
				| undefined;
		};
	},
	{}
>;
export declare const SessionStartInput: import("arktype/internal/variants/object.ts").ObjectType<
	{
		conversation_id?: string | undefined;
		generation_id?: string | undefined;
		model?: string | undefined;
		model_id?: string | undefined;
		model_params?:
			| {
					id: string;
					value: string;
			  }[]
			| undefined;
		hook_event_name?: string | undefined;
		cursor_version?: string | undefined;
		workspace_roots?: string[] | undefined;
		user_email?: string | null | undefined;
		transcript_path?: string | null | undefined;
		session_id: string;
		is_background_agent?: boolean | undefined;
		composer_mode?: "agent" | "ask" | "edit" | undefined;
	},
	{}
>;
export declare const SessionStartOutput: import("arktype/internal/variants/object.ts").ObjectType<
	{
		env?:
			| {
					[x: string]: string;
			  }
			| undefined;
		additional_context?: string | undefined;
		continue?: boolean | undefined;
		user_message?: string | undefined;
	},
	{}
>;
export declare const ShellInput: import("arktype/internal/variants/object.ts").ObjectType<
	{
		conversation_id?: string | undefined;
		generation_id?: string | undefined;
		model?: string | undefined;
		model_id?: string | undefined;
		model_params?:
			| {
					id: string;
					value: string;
			  }[]
			| undefined;
		hook_event_name?: string | undefined;
		cursor_version?: string | undefined;
		workspace_roots?: string[] | undefined;
		user_email?: string | null | undefined;
		transcript_path?: string | null | undefined;
		command: string;
		cwd?: string | undefined;
		sandbox?: boolean | undefined;
	},
	{}
>;
export declare const ShellOutput: import("arktype/internal/variants/object.ts").ObjectType<
	{
		permission: "allow" | "ask" | "deny";
		continue?: boolean | undefined;
		user_message?: string | undefined;
		agent_message?: string | undefined;
	},
	{}
>;
export declare const AfterFileEditInput: import("arktype/internal/variants/object.ts").ObjectType<
	{
		conversation_id?: string | undefined;
		generation_id?: string | undefined;
		model?: string | undefined;
		model_id?: string | undefined;
		model_params?:
			| {
					id: string;
					value: string;
			  }[]
			| undefined;
		hook_event_name?: string | undefined;
		cursor_version?: string | undefined;
		workspace_roots?: string[] | undefined;
		user_email?: string | null | undefined;
		transcript_path?: string | null | undefined;
		file_path: string;
		edits: {
			old_string: string;
			new_string: string;
		}[];
	},
	{}
>;
export declare const StopInput: import("arktype/internal/variants/object.ts").ObjectType<
	{
		conversation_id?: string | undefined;
		generation_id?: string | undefined;
		model?: string | undefined;
		model_id?: string | undefined;
		model_params?:
			| {
					id: string;
					value: string;
			  }[]
			| undefined;
		hook_event_name?: string | undefined;
		cursor_version?: string | undefined;
		workspace_roots?: string[] | undefined;
		user_email?: string | null | undefined;
		transcript_path?: string | null | undefined;
		status: "aborted" | "completed" | "error";
		loop_count: number;
	},
	{}
>;
export declare const StopOutput: import("arktype/internal/variants/object.ts").ObjectType<
	{
		followup_message?: string | undefined;
	},
	{}
>;
export declare function readStdinText(): string;
export declare function parseJson(raw: string): unknown;
export declare function emitSchema(schema: (data: unknown) => unknown, value: unknown): void;
