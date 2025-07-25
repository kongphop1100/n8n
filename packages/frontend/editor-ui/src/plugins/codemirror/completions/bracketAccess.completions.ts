import { prefixMatch, longestCommonPrefix, resolveAutocompleteExpression } from './utils';
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { Resolved } from './types';
import { escapeMappingString } from '@/utils/mappingUtils';
import { TARGET_NODE_PARAMETER_FACET } from './constants';

/**
 * Resolution-based completions offered at the start of bracket access notation.
 *
 * - `$json[|`
 * - `$input.item.json[|`
 * - `$json['field'][|`
 * - `$json.myObj[|`
 * - `$('Test').last().json.myArr[|`
 * - `$input.first().json.myStr[|`
 */
export function bracketAccessCompletions(context: CompletionContext): CompletionResult | null {
	const targetNodeParameterContext = context.state.facet(TARGET_NODE_PARAMETER_FACET);
	const word = context.matchBefore(/\$[\S\s]*\[.*/);

	if (!word) return null;

	if (word.from === word.to && !context.explicit) return null;

	const skipBracketAccessCompletions = ['$input[', '$now[', '$today['];

	if (skipBracketAccessCompletions.includes(word.text)) return null;

	const base = word.text.substring(0, word.text.lastIndexOf('['));
	const tail = word.text.split('[').pop() ?? '';

	let resolved: Resolved;

	try {
		resolved = resolveAutocompleteExpression(
			`={{ ${base} }}`,
			targetNodeParameterContext?.nodeName,
		);
	} catch {
		return null;
	}

	if (resolved === null || resolved === undefined || typeof resolved !== 'object') return null;

	let options = bracketAccessOptions(resolved);

	if (tail !== '') {
		options = options.filter((o) => prefixMatch(o.label, tail));
	}

	if (options.length === 0) return null;

	return {
		from: word.to - tail.length,
		options,
		filter: false,
		getMatch(completion: Completion) {
			const lcp = longestCommonPrefix(tail, completion.label);

			return [0, lcp.length];
		},
	};
}

function bracketAccessOptions(resolved: object) {
	const SKIP = new Set(['__ob__', 'pairedItem']);

	return Object.keys(resolved)
		.filter((key) => !SKIP.has(key))
		.map((key) => {
			const isNumber = !isNaN(parseInt(key)); // array or string index

			return {
				label: isNumber ? `${key}]` : `'${escapeMappingString(key)}']`,
				type: 'keyword',
			};
		});
}
