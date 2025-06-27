import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Autocomplete,
  CircularProgress,
  createFilterOptions,
} from "@mui/material";
import { Tag } from "../types";
import { CursorResponse } from "../hooks/useInfinite";
import { getTags } from "../services/tag";
import { createTag, assignTag } from "../services/tagging";

type OwnerType = "media" | "persons";

interface TagAdderProps {
  ownerType: OwnerType;
  ownerId: number;
  existingTags: Tag[];
  onTagAdded: () => void;
}

// A custom type for our Autocomplete options, which can be a real Tag or a "Create" action
interface TagOption extends Partial<Tag> {
  inputValue?: string; // This will hold the name for a new tag
}

// This helper from MUI allows us to customize filtering, which we'll use to add our "Create" option
const filter = createFilterOptions<TagOption>();

export default function TagAdder({
  ownerType,
  ownerId,
  existingTags,
  onTagAdded,
}: TagAdderProps) {
  // We only need to track the list of all available tags now
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTags(1) // Assuming getTags can fetch all tags or takes a page parameter
      .then((data) => setAllTags(data || []))
      .catch((error) => console.error("Failed to load all tags:", error))
      .finally(() => setLoading(false));
  }, []);

  const handleSelection = async (
    event: React.SyntheticEvent,
    newValue: string | TagOption | null
  ) => {
    if (!newValue) return;

    let tagNameToProcess: string;

    // This is a "Create new tag" action
    if (typeof newValue === "object" && newValue.inputValue) {
      tagNameToProcess = newValue.inputValue;
    }
    // This is selecting an existing tag
    else if (typeof newValue === "object" && newValue.name) {
      tagNameToProcess = newValue.name;
    }
    // This is for when the user types and hits Enter without selecting
    else if (typeof newValue === "string") {
      tagNameToProcess = newValue;
    } else {
      return;
    }

    const finalTagName = tagNameToProcess.trim().toLowerCase();
    if (!finalTagName) return;

    if (existingTags.some((t) => t.name.toLowerCase() === finalTagName)) {
      console.log(`Tag "${finalTagName}" is already assigned.`);
      return;
    }

    // Find or create the tag
    let tagToAssign = allTags.find(
      (t) => t.name.toLowerCase() === finalTagName
    );
    if (!tagToAssign) {
      try {
        tagToAssign = await createTag(finalTagName);
        setAllTags((prev) => [...prev, tagToAssign!]);
      } catch (error) {
        console.error("Error creating tag:", error);
        return;
      }
    }

    // Assign the tag
    try {
      await assignTag(ownerType, ownerId, tagToAssign!.id);
      onTagAdded();
    } catch (error) {
      console.error("Error assigning tag:", error);
    }
  };

  const availableOptions = allTags.filter(
    (tag) => !existingTags.some((existingTag) => existingTag.id === tag.id)
  );

  return (
    <Autocomplete
      fullWidth
      freeSolo
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      value={null}
      onChange={handleSelection}
      options={availableOptions}
      loading={loading}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;
        if (option.inputValue) return option.name; // For "Create..." text
        return option.name ?? "";
      }}
      filterOptions={(options, params) => {
        const filtered = filter(options, params);
        const { inputValue } = params;
        // Suggest the creation of a new value
        const isExisting = options.some((option) => inputValue === option.name);
        if (inputValue !== "" && !isExisting) {
          filtered.push({
            inputValue: inputValue,
            name: `Create "${inputValue}"`,
          });
        }
        return filtered;
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.id || option.inputValue}>
          {option.name}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="filled"
          size="small"
          placeholder="Add or create a tag..."
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
