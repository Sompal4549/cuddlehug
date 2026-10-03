import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:cuddlehug_app/core/widgets/app_text_field.dart';
import 'package:cuddlehug_app/features/account/application/addresses_controller.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Create/edit one address. Validation mirrors the backend zod schema
/// (`createAddressSchema`) so the server rarely rejects a valid form.
class AddressEditScreen extends ConsumerStatefulWidget {
  const new({this.addressId, super.key});

  /// Null → create mode.
  final String? addressId;

  @override
  ConsumerState<AddressEditScreen> createState() => _AddressEditScreenState();
}

class _AddressEditScreenState extends ConsumerState<AddressEditScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _label;
  late final TextEditingController _fullName;
  late final TextEditingController _phone;
  late final TextEditingController _line1;
  late final TextEditingController _line2;
  late final TextEditingController _city;
  late final TextEditingController _state;
  late final TextEditingController _pincode;
  bool _isDefault = false;
  bool _saving = false;

  bool get _isEdit => widget.addressId != null;

  @override
  void initState() {
    super.initState();
    final existing = _existing();
    _label = TextEditingController(text: existing?.label ?? 'Home');
    _fullName = TextEditingController(text: existing?.fullName);
    _phone = TextEditingController(text: existing?.phone);
    _line1 = TextEditingController(text: existing?.line1);
    _line2 = TextEditingController(text: existing?.line2);
    _city = TextEditingController(text: existing?.city);
    _state = TextEditingController(text: existing?.state);
    _pincode = TextEditingController(text: existing?.pincode);
    _isDefault = existing?.isDefault ?? false;
  }

  Address? _existing() {
    if (widget.addressId == null) return null;
    for (final address in ref.read(addressesProvider).items) {
      if (address.id == widget.addressId) return address;
    }
    return null;
  }

  @override
  void dispose() {
    _label.dispose();
    _fullName.dispose();
    _phone.dispose();
    _line1.dispose();
    _line2.dispose();
    _city.dispose();
    _state.dispose();
    _pincode.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _saving = true);
    final input = AddressInput(
      label: _label.text.trim(),
      fullName: _fullName.text.trim(),
      phone: _phone.text.trim(),
      line1: _line1.text.trim(),
      line2: _line2.text.trim().isEmpty ? null : _line2.text.trim(),
      city: _city.text.trim(),
      state: _state.text.trim(),
      pincode: _pincode.text.trim(),
      isDefault: _isDefault,
    );
    try {
      if (_isEdit) {
        await ref
            .read(addressesProvider.notifier)
            .update(widget.addressId!, input);
      } else {
        await ref.read(addressesProvider.notifier).create(input);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(_isEdit ? 'Address updated' : 'Address saved'),
          ),
        );
      context.pop();
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(error.message)));
      }
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(content: Text('Could not save the address')),
          );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Edit address' : 'New address')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            AppTextField(
              label: 'Label',
              controller: _label,
              hint: 'Home, Work…',
            ),
            AppTextField(
              label: 'Full name',
              controller: _fullName,
              textInputAction: TextInputAction.next,
              validator: (value) {
                final text = value?.trim() ?? '';
                if (text.length < 3) return 'Enter the full name';
                if (text.length > 80) return 'Name is too long';
                return null;
              },
            ),
            AppTextField(
              label: 'Phone',
              controller: _phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              validator: (value) {
                final text = value?.trim() ?? '';
                if (!RegExp(r'^[+]?[0-9][0-9\s-]{7,15}$').hasMatch(text)) {
                  return 'Enter a valid phone number';
                }
                return null;
              },
            ),
            AppTextField(
              label: 'Address line 1',
              controller: _line1,
              textInputAction: TextInputAction.next,
              validator: (value) {
                final text = value?.trim() ?? '';
                if (text.length < 3) return 'Enter the address';
                if (text.length > 160) return 'Address is too long';
                return null;
              },
            ),
            AppTextField(
              label: 'Address line 2 (optional)',
              controller: _line2,
              textInputAction: TextInputAction.next,
            ),
            Row(
              children: [
                Expanded(
                  child: AppTextField(
                    label: 'City',
                    controller: _city,
                    textInputAction: TextInputAction.next,
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      if (text.length < 2 || text.length > 60) {
                        return 'Enter a valid city';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: AppTextField(
                    label: 'State',
                    controller: _state,
                    textInputAction: TextInputAction.next,
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      if (text.length < 2 || text.length > 60) {
                        return 'Enter a valid state';
                      }
                      return null;
                    },
                  ),
                ),
              ],
            ),
            AppTextField(
              label: 'Pincode',
              controller: _pincode,
              keyboardType: TextInputType.number,
              validator: (value) {
                final text = value?.trim() ?? '';
                if (!RegExp(r'^[1-9][0-9]{5}$').hasMatch(text)) {
                  return 'Enter a valid pincode';
                }
                return null;
              },
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Set as default address'),
              value: _isDefault,
              onChanged: (value) => setState(() => _isDefault = value),
            ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: _isEdit ? 'Save changes' : 'Save address',
              loading: _saving,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}
