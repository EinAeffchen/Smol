import React, { useState } from 'react'
import {
    Box,
    Button,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from '@mui/material'

export function PersonEditForm({ initialPersonData, onSave, saving }) {
    const [form, setForm] = useState(initialPersonData);

    // Handle input changes locally
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setForm(prevForm => ({
            ...prevForm,
            [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ flex: 1 }}>
            <Grid container spacing={2} alignItems="flex-end">
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        label="Name"
                        name="name"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        label="Age"
                        name="age"
                        type="number"
                        value={form.age}
                        onChange={e => setForm({ ...form, age: e.target.value })}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <FormControl fullWidth>
                        <InputLabel>Gender</InputLabel>
                        <Select
                            name="gender"
                            value={form.gender}
                            onChange={e => setForm({ ...form, gender: e.target.value })}
                            label="Gender"
                        >
                            <MenuItem value="">— select —</MenuItem>
                            <MenuItem value="male">Male</MenuItem>
                            <MenuItem value="female">Female</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <Button fullWidth type="submit" variant="contained" color="primary" disabled={saving} size="large" sx={{ height: '56px' }}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </Grid>
            </Grid>
        </Box>
    );
}