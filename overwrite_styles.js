function overlaps(range1, range2) {
	// Check if two ranges overlap
	return !(
		range1.endRow < range2.startRow ||
		range1.startRow > range2.endRow ||
		range1.endCol < range2.startCol ||
		range1.startCol > range2.endCol
	);
}

function getIntersection(range1, range2) {
	// Calculate the intersection of two ranges
	return {
		startRow: Math.max(range1.startRow, range2.startRow),
		endRow: Math.min(range1.endRow, range2.endRow),
		startCol: Math.max(range1.startCol, range2.startCol),
		endCol: Math.min(range1.endCol, range2.endCol),
	};
}

function getNonOverlappingRegions(range, intersection) {
	// Divide the range into non-overlapping regions
	const regions = [];

	if (range.startRow < intersection.startRow) {
		regions.push({
			startRow: range.startRow,
			endRow: intersection.startRow - 1,
			startCol: range.startCol,
			endCol: range.endCol,
		});
	}
	if (range.endRow > intersection.endRow) {
		regions.push({
			startRow: intersection.endRow + 1,
			endRow: range.endRow,
			startCol: range.startCol,
			endCol: range.endCol,
		});
	}
	if (range.startCol < intersection.startCol) {
		regions.push({
			startRow: Math.max(range.startRow, intersection.startRow),
			endRow: Math.min(range.endRow, intersection.endRow),
			startCol: range.startCol,
			endCol: intersection.startCol - 1,
		});
	}
	if (range.endCol > intersection.endCol) {
		regions.push({
			startRow: Math.max(range.startRow, intersection.startRow),
			endRow: Math.min(range.endRow, intersection.endRow),
			startCol: intersection.endCol + 1,
			endCol: range.endCol,
		});
	}

	return regions;
}

function handleMultipleOverlaps(currentSelection, blocks) {
	const newBlocks = [];
	const overlappingRegions = [];

	blocks.forEach((block) => {
		if (overlaps(currentSelection.range, block.range)) {
			// Calculate intersection
			const intersection = getIntersection(currentSelection.range, block.range);
			overlappingRegions.push({ block, intersection });

			// Divide the current selection into non-overlapping regions
			const nonOverlapping = getNonOverlappingRegions(
				currentSelection.range,
				intersection
			);
			nonOverlapping.forEach((region) => {
				newBlocks.push({ range: region, style: currentSelection.style });
			});

			// Assign the intersection to the block with higher priority
			if (currentSelection.style.priority > (block.style.priority || 0)) {
				if (!block.children) block.children = [];
				block.children.push({
					range: intersection,
					style: currentSelection.style,
				});
			} else {
				if (!currentSelection.children) currentSelection.children = [];
				currentSelection.children.push({
					range: intersection,
					style: block.style,
				});
			}
		}
	});

	// Add remaining non-overlapping regions of the current selection
	if (overlappingRegions.length === 0) {
		newBlocks.push(currentSelection);
	} else {
		getNonOverlappingRegions(
			currentSelection.range,
			overlappingRegions.map((r) => r.intersection)
		).forEach((region) => {
			newBlocks.push({ range: region, style: currentSelection.style });
		});
	}

	// Return updated blocks with new blocks added
	return [...blocks, ...newBlocks];
}

// Example usage:
const blocks = [
	{
		id: 1,
		range: { startRow: 2, endRow: 8, startCol: 14, endCol: 18 },
		style: { backgroundColor: "yellow", priority: 1 },
	},
	{
		id: 2,
		range: { startRow: 4, endRow: 12, startCol: 14, endCol: 19 },
		style: { backgroundColor: "green", priority: 2 },
	},
	{
		id: 3,
		range: { startRow: 6, endRow: 10, startCol: 14, endCol: 16 },
		style: { backgroundColor: "orange", priority: 3 },
	},
	{
		id: 4,
		range: { startRow: 6, endRow: 10, startCol: 17, endCol: 19 },
		style: { backgroundColor: "red", priority: 4 },
	},
];

const currentSelection = {
	id: 5,
	range: { startRow: 5, endRow: 12, startCol: 14, endCol: 20 },
	style: { backgroundColor: "purple", priority: 5 },
};

const updatedBlocks = handleMultipleOverlaps(currentSelection, blocks);
console.log(updatedBlocks);
