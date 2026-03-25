import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf, Location as AngularLocation } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InventoryService } from '../../services/inventory.service';
import { ImageService } from '../../services/image.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { BarcodeService } from '../../services/barcode.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { ExpirationAIService } from '../../services/expiration-ai.service';
import { InventoryItem, Category, Location } from '../../models/inventory.model';
import { CategorySelectorComponent } from './category-selector.component';
import { LocationSelectorComponent } from './location-selector.component';
import { AISuggestionDialogComponent } from './ai-suggestion-dialog.component';
import { ImageSelectorDialogComponent, ImageOption } from './image-selector-dialog.component';

@Component({
  selector: 'app-item-form',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatBottomSheetModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
})
export class ItemForm implements OnInit {
  itemId: number | null = null;
  isEditMode = false;
  userId: number | null = null;

  // Form fields
  itemName = '';
  barcode = '';
  selectedCategory: Category | null = null;
  quantity = 1;
  unit = 'piece';
  purchaseDate: Date | null = new Date();
  expirationDate: Date | null = null;
  // Custom expiration inputs (number + unit)
  useCustomExpirationPicker = false;
  expireAmount: number | null = null;
  expireUnit: 'days' | 'weeks' | 'months' | 'years' = 'days';
  // AI suggestion tracking
  aiSuggestedDays: number | null = null;
  aiSuggestedNote: string | null = null;
  computedExpirationPreview: string = '';
  selectedLocation: Location | null = null;
  price: number | null = null;
  notes = '';
  allowNotification = true;
  capturedImage: string | null = null;
  capturedImagePath: string | null = null; // Store the file path separately
  imageChanged = false; // Track if user changed the image
  isScanning = false;
  isLoadingAI = false; // Track AI request status

  // Usage tracking fields (for edit mode)
  initialQuantity: number | null = null;
  currentQuantity: number | null = null;

  // Unit options
  units = [
    'piece', 'kg', 'g', 'lb', 'oz',
    'L', 'ml', 'gallon', 'cup',
    'box', 'can', 'bottle', 'bag', 'pack'
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: AngularLocation,
    private inventoryService: InventoryService,
    private imageService: ImageService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private barcodeService: BarcodeService,
    private expirationAIService: ExpirationAIService,
    private bottomSheet: MatBottomSheet,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  async ngOnInit() {
    this.userId = await this.authService.getUserId();

    // Check if editing existing item
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.itemId = parseInt(id);
      this.isEditMode = true;
      await this.loadItem();
    }
  }

  async loadItem() {
    if (!this.itemId || !this.userId) return;

    try {
      const items = await this.inventoryService.getItems(this.userId);
      const item = items.find(i => i.id === this.itemId);

      if (item) {
        this.itemName = item.name;
        this.quantity = item.quantity;
        this.unit = item.unit;
        this.purchaseDate = item.purchaseDate ? this.parseLocalDate(item.purchaseDate) : null;
        this.expirationDate = item.expirationDate ? this.parseLocalDate(item.expirationDate) : null;
        this.price = item.price || null;
        this.notes = item.notes || '';
        this.allowNotification = item.notificationEnabled ?? false;
        this.barcode = item.barcode || '';
        this.initialQuantity = item.initialQuantity || item.quantity;
        this.currentQuantity = item.currentQuantity !== undefined ? item.currentQuantity : item.quantity;

        // Load category
        const categories = await this.inventoryService.getCategories();
        this.selectedCategory = categories.find(c => c.id === item.categoryId) || null;

        // Load location
        const locations = await this.inventoryService.getLocations(this.userId);
        this.selectedLocation = locations.find(l => l.id === item.locationId) || null;

        // Load image
        if (item.id) {
          const images = await this.inventoryService.getItemImages(item.id);
          if (images.length > 0 && images[0].imagePath) {
            // Store the path for saving
            this.capturedImagePath = images[0].imagePath;
            // Convert to displayable format
            this.capturedImage = await this.imageService.getImageUrl(images[0].imagePath);
            // Image was loaded from existing item, not changed by user
            this.imageChanged = false;
          }
        }
      }
      // Sync the custom inputs with the loaded expiration date if available
      if (this.expirationDate) {
        this.syncInputsFromExpirationDate();
      }
    } catch (error) {
      console.error('Error loading item:', error);
      this.snackBar.open('Failed to load item', 'Close', { duration: 3000 });
    }
  }

  openCategorySelector() {
    const bottomSheetRef = this.bottomSheet.open(CategorySelectorComponent, { panelClass: 'centered-bottom-sheet' });
    bottomSheetRef.afterDismissed().subscribe((category: Category) => {
      if (category) {
        this.selectedCategory = category;
      }
    });
  }

  openLocationSelector() {
    const bottomSheetRef = this.bottomSheet.open(LocationSelectorComponent, {
      data: { userId: this.userId },
      panelClass: 'centered-bottom-sheet'
    });
    bottomSheetRef.afterDismissed().subscribe((location: Location) => {
      if (location) {
        this.selectedLocation = location;
      }
    });
  }

  async takePicture() {
    try {
      const imagePath = await this.imageService.takePicture();
      if (imagePath) {
        // Store file path for saving to database
        this.capturedImagePath = imagePath;
        // Convert file path to base64 data URI for display
        this.capturedImage = await this.imageService.getImageUrl(imagePath);
        this.imageChanged = true;
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      this.snackBar.open('Failed to take picture', 'Close', { duration: 3000 });
    }
  }

  async selectFromGallery() {
    try {
      const imagePath = await this.imageService.selectFromGallery();
      if (imagePath) {
        // Store file path for saving to database
        this.capturedImagePath = imagePath;
        // Convert file path to base64 data URI for display
        this.capturedImage = await this.imageService.getImageUrl(imagePath);
        this.imageChanged = true;
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      this.snackBar.open('Failed to select image', 'Close', { duration: 3000 });
    }
  }

  removeImage() {
    this.capturedImage = null;
    this.capturedImagePath = null;
    this.imageChanged = true;
  }

  validateForm(): boolean {
    if (!this.itemName.trim()) {
      this.snackBar.open('Item name is required', 'Close', { duration: 3000 });
      return false;
    }

    if (!this.selectedCategory) {
      this.snackBar.open('Please select a category', 'Close', { duration: 3000 });
      return false;
    }

    if (this.quantity <= 0) {
      this.snackBar.open('Quantity must be greater than 0', 'Close', { duration: 3000 });
      return false;
    }

    if (!this.selectedLocation) {
      this.snackBar.open('Please select a storage location', 'Close', { duration: 3000 });
      return false;
    }

    if (this.expirationDate && this.purchaseDate && this.expirationDate < this.purchaseDate) {
      this.snackBar.open('Expiration date cannot be before purchase date', 'Close', { duration: 3000 });
      return false;
    }

    return true;
  }

  async onSave() {
    if (!this.validateForm() || !this.userId || !this.selectedCategory || !this.selectedLocation) {
      return;
    }

    // Save barcode learning if applicable
    if (this.barcode) {
      await this.saveBarcodeLearning();
    }

    try {
      const formattedExpirationDate = this.expirationDate ? this.formatDateToString(this.expirationDate) : undefined;
      
      // Calculate price per unit from total price
      const pricePerUnit = this.price && this.quantity > 0 ? this.price / this.quantity : undefined;
      
      const itemData: Partial<InventoryItem> = {
        userId: this.userId,
        name: this.itemName.trim(),
        categoryId: this.selectedCategory.id!,
        quantity: this.quantity,
        unit: this.unit,
        purchaseDate: this.purchaseDate ? this.formatDateToString(this.purchaseDate) : undefined,
        expirationDate: formattedExpirationDate,
        locationId: this.selectedLocation.id!,
        price: pricePerUnit,
        notes: this.notes.trim() || undefined,
        notificationEnabled: this.allowNotification,
        notificationDaysBefore: 3,
        barcode: this.barcode || undefined,
        initialQuantity: this.isEditMode && this.initialQuantity !== null ? this.initialQuantity : this.quantity,
        currentQuantity: this.isEditMode && this.currentQuantity !== null ? this.currentQuantity : this.quantity
      };

      let savedItemId: number;

      if (this.isEditMode && this.itemId) {
        // Update existing item
        const fullItem: InventoryItem = {
          ...itemData as InventoryItem,
          id: this.itemId
        };
        const success = await this.inventoryService.updateItem(fullItem);
        if (success) {
          savedItemId = this.itemId;
          this.snackBar.open('Item updated successfully!', 'Close', { duration: 3000 });
        } else {
          throw new Error('Update failed');
        }
      } else {
        // Add new item
        const result = await this.inventoryService.addItem(itemData as InventoryItem);
        if (result.success && result.itemId) {
          savedItemId = result.itemId;
          this.snackBar.open('Item added successfully!', 'Close', { duration: 3000 });
        } else {
          throw new Error('Add failed');
        }
      }

      // Handle image updates in edit mode
      if (this.isEditMode && this.itemId) {
        // Only update images if user actually changed them
        if (this.imageChanged) {
          // Get existing images
          const existingImages = await this.inventoryService.getItemImages(savedItemId);
          
          // If user removed the image (capturedImage is null but there were existing images)
          if (!this.capturedImage && existingImages.length > 0) {
            // Delete all existing images for this item
            for (const img of existingImages) {
              if (img.id) {
                await this.inventoryService.deleteItemImage(img.id);
              }
            }
          }
          // If user added/changed the image
          else if (this.capturedImagePath) {
            // Delete old images first
            for (const img of existingImages) {
              if (img.id) {
                await this.inventoryService.deleteItemImage(img.id);
              }
            }
            // Add new image
            await this.inventoryService.addItemImage({
              itemId: savedItemId,
              imagePath: this.capturedImagePath,
              imageData: this.capturedImage || '',
              isPrimary: true
            });
          }
        }
      } else {
        // Add mode: just save image if captured
        if (this.capturedImagePath) {
          await this.inventoryService.addItemImage({
            itemId: savedItemId,
            imagePath: this.capturedImagePath,
            imageData: this.capturedImage || '',
            isPrimary: true
          });
        }
      }

      // Schedule notification if expiration date is set and notifications are enabled
      if (this.expirationDate && this.allowNotification && this.userId) {
        await this.notificationService.scheduleExpirationNotifications(this.userId);
      }

      // Create initial batch for new items (edit mode preserves existing batches)
      if (!this.isEditMode) {
        const batchId = await this.inventoryService.addBatch({
          itemId: savedItemId,
          quantity: this.quantity,
          expirationDate: this.expirationDate ? this.formatDateToString(this.expirationDate) : null,
          purchaseDate: this.purchaseDate ? this.formatDateToString(this.purchaseDate) : this.formatDateToString(new Date()),
          price: pricePerUnit || null,
          notes: this.notes.trim() || null
        });
        if (!batchId) {
          throw new Error('Item saved but failed to create initial stock batch');
        }
      }

      // Navigate back to previous page
      this.location.back();
    } catch (error) {
      console.error('Error saving item:', error);
      this.snackBar.open('Failed to save item', 'Close', { duration: 3000 });
    }
  }

  onCancel() {
    this.location.back();
  }

  /** Parse date string (YYYY-MM-DD) as local date to avoid timezone issues */
  private parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /** Compute expiration Date from custom inputs */
  computeExpirationFromInputs(): Date {
    const base = new Date(this.purchaseDate || new Date());
    const amount = this.expireAmount || 0;
    let totalDays = 0;
    if (this.expireUnit === 'years') { totalDays = amount * 365; }
    else if (this.expireUnit === 'months') { totalDays = amount * 30; }
    else if (this.expireUnit === 'weeks') { totalDays = amount * 7; }
    else { totalDays = amount; }
    const d = new Date(base);
    d.setDate(d.getDate() + totalDays);
    return d;
  }

  updateExpirationPreviewFromInputs() {
    // Update preview string based on inputs
    if (!this.expireAmount) {
      this.computedExpirationPreview = '';
      return;
    }
    this.computedExpirationPreview = this.computeExpirationFromInputs().toLocaleDateString();
  }

  applyCustomExpiration() {
    if (this.expireAmount != null && this.expireAmount > 0) {
      this.expirationDate = this.computeExpirationFromInputs();
    }
    this.updateExpirationPreviewFromInputs();
  }

  resetCustomExpiration() {
    this.expireAmount = null;
    this.expireUnit = 'days';
    this.computedExpirationPreview = '';
    this.expirationDate = null;
  }

  syncInputsFromExpirationDate() {
    if (!this.expirationDate) {
      this.expireAmount = null;
      return;
    }
    const base = new Date(this.purchaseDate || new Date());
    const diffMs = this.expirationDate.getTime() - base.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays % 365 === 0) {
      this.expireUnit = 'years';
      this.expireAmount = diffDays / 365;
    }
    else if (diffDays % 30 === 0) {
      this.expireUnit = 'months';
      this.expireAmount = diffDays / 30;
    } else if (diffDays % 7 === 0) {
      this.expireUnit = 'weeks';
      this.expireAmount = diffDays / 7;
    } else {
      this.expireUnit = 'days';
      this.expireAmount = diffDays;
    }
    this.updateExpirationPreviewFromInputs();
  }

  async onScanBarcode() {
    if (!this.userId) return;

    this.isScanning = true;

    try {
      console.info('[onScanBarcode] Starting barcode scan');
      let scannedBarcode: string | null = null;

      try {
        scannedBarcode = await this.barcodeService.scanBarcode();
        console.info('[onScanBarcode] scanBarcode returned:', scannedBarcode);
      } catch (scanErr) {
        console.error('[onScanBarcode] scanBarcode failed:', scanErr);
        this.snackBar.open('Failed scanning barcode (camera scan step). See logs for details.', 'Close', { duration: 5000 });
        return;
      }

      if (!scannedBarcode) {
        console.warn('[onScanBarcode] scanBarcode returned no value (no barcode read)');
        this.snackBar.open('No barcode detected', 'Close', { duration: 3000 });
        return;
      }

      this.barcode = scannedBarcode;

      // Check if we've seen this barcode before (learn-as-you-go)
      let mapping: any = null;
      try {
        mapping = await this.barcodeService.getBarcodeMapping(scannedBarcode, this.userId);
        console.info('[onScanBarcode] getBarcodeMapping returned:', mapping);
      } catch (mapErr) {
        console.error('[onScanBarcode] getBarcodeMapping failed:', mapErr);
        this.snackBar.open('Failed scanning barcode (mapping lookup). See logs for details.', 'Close', { duration: 5000 });
        return;
      }

      if (mapping) {
        // Auto-fill from learned data
        this.itemName = mapping.itemName;

        // Find and set category
        try {
          const categories = await this.inventoryService.getCategories();
          this.selectedCategory = categories.find(c => c.id === mapping.categoryId) || null;
        } catch (categoryErr) {
          console.error('[onScanBarcode] Failed fetching categories:', categoryErr);
          // Not a blocking error; continue but log it
        }

        // Auto-fill price from cached data
        if (mapping.price) {
          this.price = mapping.price;
        }

        // Auto-fill storage location from cached data
        if (mapping.locationId) {
          try {
            const locations = await this.inventoryService.getLocations(this.userId);
            this.selectedLocation = locations.find(l => l.id === mapping.locationId) || null;
          } catch (locationErr) {
            console.error('[onScanBarcode] Failed fetching location:', locationErr);
          }
        }

        // Auto-fill image - only replace if barcode has cached images
        try {
          const barcodeImages = await this.inventoryService.getImagesByBarcode(scannedBarcode, this.userId);
          
          // Only auto-fill image if we found images for this barcode
          if (barcodeImages.length > 1) {
            // Multiple images available - let user choose
            const imageOptions: ImageOption[] = [];
            for (const img of barcodeImages) {
              const displayUrl = await this.imageService.getImageUrl(img.imagePath);
              imageOptions.push({
                imagePath: img.imagePath,
                displayUrl: displayUrl
              });
            }

            const dialogRef = this.dialog.open(ImageSelectorDialogComponent, {
              width: '90%',
              maxWidth: '600px',
              data: {
                images: imageOptions,
                itemName: mapping.itemName
              }
            });

            dialogRef.afterClosed().subscribe((selectedImage: ImageOption | null) => {
              if (selectedImage) {
                this.capturedImagePath = selectedImage.imagePath;
                this.capturedImage = selectedImage.displayUrl;
              }
            });
          } else if (barcodeImages.length === 1) {
            // Single image - auto-fill directly (replace existing)
            this.capturedImagePath = barcodeImages[0].imagePath;
            this.capturedImage = await this.imageService.getImageUrl(barcodeImages[0].imagePath);
          } else if (mapping.imagePath) {
            // Use image from barcode mapping if no item images found (replace existing)
            this.capturedImagePath = mapping.imagePath;
            this.capturedImage = await this.imageService.getImageUrl(mapping.imagePath);
          }
          // If no images found (barcodeImages.length === 0 && !mapping.imagePath), 
          // keep the current image - don't replace it
        } catch (imageErr) {
          console.error('[onScanBarcode] Failed loading images:', imageErr);
          // On error, keep current image - don't replace it
        }

        // Auto-suggest expiration from cached AI data
        if (mapping.suggestedShelfLifeDays && this.purchaseDate) {
          const suggestedDate = new Date(this.purchaseDate);
          suggestedDate.setDate(suggestedDate.getDate() + mapping.suggestedShelfLifeDays);
          this.expirationDate = suggestedDate;
          this.syncInputsFromExpirationDate();
          
          let message = `Auto-filled: ${mapping.itemName}`;
          if (mapping.aiNote) {
            message += ` (${mapping.aiNote})`;
          }
          this.snackBar.open(message, 'Close', { duration: 4000 });
        } else {
          this.snackBar.open(`Auto-filled from previous scan: ${mapping.itemName}`, 'Close', { duration: 3000 });
        }
      } else {
        // First time seeing this barcode
        this.snackBar.open('New barcode! Please enter item details.', 'Close', { duration: 4000 });
      }
    } catch (error) {
      console.error('[onScanBarcode] Unexpected error:', error);
      this.snackBar.open('Failed to scan barcode', 'Close', { duration: 3000 });
    } finally {
      this.isScanning = false;
    }
  }

  async saveBarcodeLearning() {
    // Save barcode mapping for learn-as-you-go feature
    if (this.barcode && this.itemName && this.selectedCategory && this.userId) {
      await this.barcodeService.saveBarcodeMapping({
        barcode: this.barcode,
        itemName: this.itemName,
        categoryId: this.selectedCategory.id!,
        userId: this.userId,
        suggestedShelfLifeDays: this.aiSuggestedDays || null,
        aiNote: this.aiSuggestedNote || null,
        price: this.price || null,
        imagePath: this.capturedImagePath || null,
        locationId: this.selectedLocation?.id || null
      });
    }
  }

  private formatDateToString(date: Date | string | undefined): string {
    if (!date) return '';
    if (typeof date === 'string') return date;

    // Format date as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Request AI suggestion for expiration date
   */
  async onAISuggestExpiration() {
    // Validation
    if (!this.itemName?.trim()) {
      this.snackBar.open('Please enter item name first', 'Close', { duration: 3000 });
      return;
    }

    if (!this.purchaseDate) {
      this.snackBar.open('Please select purchase date first', 'Close', { duration: 3000 });
      return;
    }

    if (!this.userId) {
      this.snackBar.open('User not authenticated', 'Close', { duration: 3000 });
      return;
    }

    this.isLoadingAI = true;

    try {
      // Get storage location name if selected
      const storageLocation = this.selectedLocation?.name || null;

      // Call AI service
      const suggestion = await this.expirationAIService.suggestExpiration(
        this.itemName.trim(),
        this.purchaseDate,
        storageLocation,
        this.userId
      );

      // Calculate suggested expiration date
      const suggestedDate = new Date(this.purchaseDate);
      suggestedDate.setDate(suggestedDate.getDate() + suggestion.days);

      // Show confirmation dialog
      const dialogRef = this.dialog.open(AISuggestionDialogComponent, {
        width: '90%',
        maxWidth: '500px',
        data: {
          itemName: this.itemName,
          purchaseDate: this.purchaseDate,
          suggestedDays: suggestion.days,
          suggestedExpirationDate: suggestedDate,
          note: suggestion.note
        }
      });

      dialogRef.afterClosed().subscribe(async (result) => {
        if (result?.accepted) {
          // Apply the AI suggestion
          this.expirationDate = suggestedDate;
          this.syncInputsFromExpirationDate();
          
          // Store AI data for later barcode mapping save
          this.aiSuggestedDays = suggestion.days;
          this.aiSuggestedNote = suggestion.note;
          
          this.snackBar.open('✓ AI suggestion applied', 'Close', { duration: 3000 });
        }
      });
    } catch (error: any) {
      console.error('AI suggestion error:', error);
      this.snackBar.open(
        error.message || 'Failed to get AI suggestion',
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.isLoadingAI = false;
    }
  }
}
