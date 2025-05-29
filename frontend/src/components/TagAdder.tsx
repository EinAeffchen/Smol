import React, { useState, useEffect } from 'react'
import {
    Box,
    TextField,
    Button,
    Autocomplete,
    CircularProgress,
    Chip
} from '@mui/material';
import { Tag } from '../types'
import { CursorResponse } from '../hooks/useInfinite'

type OwnerType = 'media' | 'persons'

interface TagAdderProps {
    ownerType: OwnerType
    ownerId: number
    existingTags: Tag[]
    onTagAdded: (tag: Tag) => void
}

export default function TagAdder({
    ownerType,
    ownerId,
    existingTags,
    onTagAdded,
}: TagAdderProps) {
    const [inputValue, setInputValue] = useState('')
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [loadingAllTags, setLoadingAllTags] = useState(false);
    const API = import.meta.env.VITE_API_BASE_URL ?? ''

    useEffect(() => {
        setLoadingAllTags(true);
        fetch(`${API}/tags/`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch tags: ${res.status}`);
                }
                return res.json();
            })
            .then((page: CursorResponse<Tag>) => {
                setAllTags(page.items || []);
            })
            .catch(error => {
                console.error("Failed to load all tags:", error);
                setAllTags([]); // Set to empty or handle error appropriately
            }).finally(() => {
                setLoadingAllTags(false);
            });
    }, [API])

    const handleAddTag = async () => {
        const nameToAdd = inputValue.trim().toLowerCase();
        if (!nameToAdd) return;

        if (existingTags.some(t => t.name.toLowerCase() === nameToAdd)) {
            console.log(`Tag "${nameToAdd}" is already assigned.`);
            setInputValue(''); // Clear input
            return;
        }

        let tagToAssign: Tag | undefined = allTags.find(t => t.name.toLowerCase() === nameToAdd);

        if (!tagToAssign) {
            // Tag doesn't exist globally, so create it
            try {
                const createRes = await fetch(`${API}/tags/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: nameToAdd }), // Use the processed name
                });
                if (!createRes.ok) {
                    const errorText = await createRes.text();
                    console.error('Failed to create tag:', errorText);
                    // Potentially show a user-facing error
                    return;
                }
                tagToAssign = await createRes.json();
                setAllTags(prevTags => [...prevTags, tagToAssign!]); // Add to local cache of all tags
            } catch (error) {
                console.error('Error creating tag:', error);
                return;
            }
        }

        try {
            const assignRes = await fetch(`${API}/tags/${ownerType}/${ownerId}/${tagToAssign!.id}`, {
                method: 'POST',
            });
            if (!assignRes.ok) {
                const errorText = await assignRes.text();
                console.error('Failed to assign tag:', errorText);
                // Potentially show a user-facing error
                return;
            }
            onTagAdded(tagToAssign!);
            setInputValue(''); // Clear input after successful addition
        } catch (error) {
            console.error('Error assigning tag:', error);
        }

    }

    const suggestionOptions = allTags.filter(
        tag => !existingTags.some(existingTag => existingTag.id === tag.id)
    );
    return (
        <Box display="flex" gap={1} alignItems="center" sx={{ width: '90%' }}>
            <Autocomplete
                freeSolo // Allows users to enter text not present in suggestions
                fullWidth
                inputValue={inputValue}
                onInputChange={(event, newInputValue, reason) => {
                    setInputValue(newInputValue);
                }}
                onChange={(event, newValue) => {
                    if (typeof newValue === 'object' && newValue !== null) {
                        setInputValue(newValue.name);
                    } else if (typeof newValue === 'string') {
                        setInputValue(newValue);
                    }
                }}
                options={suggestionOptions}
                getOptionLabel={(option) => {
                    // Material-UI Autocomplete might pass a string if freeSolo is used and the input doesn't match an option
                    if (typeof option === 'string') {
                        return option;
                    }
                    return option.name;
                }}
                renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                        {option.name}
                    </li>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        variant="outlined"
                        size="small"
                        placeholder="Add tag (e.g. travel, food)"
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loadingAllTags ? <CircularProgress color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault(); // Prevent form submission if it's in a form
                                if (inputValue.trim()) {
                                    handleAddTag();
                                }
                            }
                        }}
                    />
                )}
                loading={loadingAllTags}
                loadingText="Loading tags…"
                sx={{ flexGrow: 1 }}
            />
            <Button
                variant="contained"
                color="secondary"
                onClick={handleAddTag}
                disabled={!inputValue.trim() || loadingAllTags}
            >
                Add
            </Button>
        </Box>
    )
}
